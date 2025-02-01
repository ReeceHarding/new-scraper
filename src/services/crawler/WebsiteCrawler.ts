import { Browser, Page } from 'puppeteer';
import { BrowserService } from '../browser/BrowserService';
import { URLManager } from './URLManager';
import { logger } from '../../lib/logging';
import { RateLimiter as BaseRateLimiter } from '@/services/utils/RateLimiter';
import { RobotsTxtParser } from '../crawler/RobotsTxtParser';
import { CacheService } from '../cache/CacheService';

interface ExtendedRateLimiter extends BaseRateLimiter {
  release: () => void;
}

interface CrawlOptions {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  maxDepth: number;
  concurrency: number;
  respectRobotsTxt: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
  resourceLimits?: {
    maxMemory?: number;
    maxCPU?: number;
    maxBandwidth?: number;
  };
}

interface PageMetrics {
  loadTime: number;
  contentSize: number;
}

interface CrawlerError {
  message: string;
  code: string;
  retries: number;
}

interface PageResult {
  url: string;
  content: string;
  links: string[];
  depth: number;
  metrics?: PageMetrics;
  error?: CrawlerError;
}

interface CrawlMetrics {
  pagesProcessed: number;
  totalTime: number;
  averageLoadTime: number;
  totalSize: number;
  errorCount: number;
  cacheHits: number;
  cacheMisses: number;
}

export class WebsiteCrawler {
  private readonly browserService: BrowserService;
  private readonly urlManager: URLManager;
  private readonly rateLimiter: ExtendedRateLimiter;
  private readonly robotsTxtParser: RobotsTxtParser;
  private readonly cacheService: CacheService;
  private readonly options: Required<CrawlOptions>;
  private metrics: CrawlMetrics = {
    pagesProcessed: 0,
    totalTime: 0,
    averageLoadTime: 0,
    totalSize: 0,
    errorCount: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  private workerPool: Browser[] = [];
  private isShuttingDown = false;

  constructor(
    browserService: BrowserService,
    options: Partial<CrawlOptions> = {}
  ) {
    this.browserService = browserService;
    this.urlManager = new URLManager();
    this.robotsTxtParser = new RobotsTxtParser();
    this.cacheService = CacheService.getInstance();
    
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      timeout: options.timeout || 30000,
      maxDepth: options.maxDepth || 3,
      concurrency: options.concurrency || 5,
      respectRobotsTxt: options.respectRobotsTxt ?? true,
      cacheEnabled: options.cacheEnabled ?? true,
      cacheTTL: options.cacheTTL || 3600,
      resourceLimits: {
        maxMemory: options.resourceLimits?.maxMemory || 80,
        maxCPU: options.resourceLimits?.maxCPU || 80,
        maxBandwidth: options.resourceLimits?.maxBandwidth || 10
      }
    };
    
    this.rateLimiter = new BaseRateLimiter(this.options.retryDelay) as ExtendedRateLimiter;

    // Handle graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Initializes the worker pool
   */
  private async initWorkerPool(): Promise<void> {
    for (let i = 0; i < this.options.concurrency; i++) {
      const browser = await this.browserService.getBrowser();
      this.workerPool.push(browser);
    }
    logger.info('Worker pool initialized', {
      size: this.workerPool.length
    });
  }

  /**
   * Gets a browser from the worker pool
   */
  private async getBrowser(): Promise<Browser> {
    try {
      const browser = await this.browserService.getBrowser();
      this.workerPool.push(browser);
      return browser;
    } catch (error) {
      logger.error('Failed to get browser instance', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Returns a browser to the worker pool
   */
  private async releaseBrowser(browser: Browser): Promise<void> {
    if (this.isShuttingDown) {
      await browser.close();
      return;
    } 
    
    if (this.workerPool.length < this.options.concurrency) {
      this.workerPool.push(browser);
      return;
    }
    
    await browser.close();
  }

  /**
   * Gracefully shuts down the crawler
   */
  private async shutdown(): Promise<void> {
    logger.info('Shutting down crawler');
    this.isShuttingDown = true;

    // Close all browsers in the pool
    await Promise.all(
      this.workerPool.map(browser => browser.close())
    );
    this.workerPool = [];

    // Save final metrics
    logger.info('Crawler metrics', { metrics: this.metrics });
  }

  /**
   * Gets the error code for a given error
   */
  private getErrorCode(error: Error): string {
    const message = error.message;
    
    // Network errors
    if (message.includes('net::ERR_CONNECTION_REFUSED') || message.includes('Connection refused')) {
      return 'CONNECTION_REFUSED';
    }
    if (message.includes('net::ERR_CONNECTION_TIMED_OUT') || message.includes('Timed out') || message.includes('timeout')) {
      return 'TIMEOUT';
    }
    if (message.includes('net::ERR_NAME_NOT_RESOLVED') || message.includes('DNS lookup failed')) {
      return 'DNS_ERROR';
    }
    if (message.includes('net::ERR_FAILED') || message.includes('Network error')) {
      return 'NETWORK_ERROR';
    }
    
    // Content errors
    if (message.includes('Content extraction failed') || message.includes('Failed to extract content')) {
      return 'CONTENT_EXTRACTION_ERROR';
    }
    if (message.includes('Link extraction failed') || message.includes('Failed to extract links')) {
      return 'LINK_EXTRACTION_ERROR';
    }
    
    // Page errors
    if (message.includes('Failed to close page') || message.includes('Page close error')) {
      return 'PAGE_CLOSE_ERROR';
    }
    
    // Robots.txt errors
    if (message.includes('URL blocked by robots.txt')) {
      return 'ROBOTS_TXT_BLOCKED';
    }
    
    // Browser errors
    if (message.includes('Failed to get browser') || message.includes('Browser error')) {
      return 'BROWSER_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Processes a URL with caching
   */
  private async processUrlWithCache(url: string): Promise<PageResult> {
    // Check cache first if enabled
    if (this.options.cacheEnabled) {
      const cached = await this.cacheService.get<PageResult>(url);
      if (cached) {
        this.metrics.cacheHits++;
        logger.debug('Cache hit', { url });
        return cached;
      }
      this.metrics.cacheMisses++;
    }
    
    // Check if URL is allowed by robots.txt
    if (this.options.respectRobotsTxt && !this.robotsTxtParser.isAllowed(url)) {
      const blockedUrl = url;  // Store the original URL
      logger.debug('Skipping URL (robots.txt)', { url: blockedUrl });
      return {
        url: blockedUrl,
        content: '',
        links: [],
        depth: this.urlManager.getDepth(blockedUrl) || 0,
        error: {
          message: 'URL blocked by robots.txt',
          code: 'ROBOTS_TXT_BLOCKED',
          retries: 0
        }
      };
    }
    
    // Apply rate limiting
    await this.rateLimiter.wait();
    
    let browser: Browser | null = null;
    let page: Page | null = null;
    let result: PageResult = {
      url,
      content: '',
      links: [],
      depth: this.urlManager.getDepth(url) || 0
    };
    
    try {
      // Get a browser from the pool
      browser = await this.getBrowser();
      if (!browser) {
        throw new Error('Failed to get browser from pool');
      }
      
      // Create new page
      page = await browser.newPage();
      if (!page) {
        throw new Error('Failed to create page');
      }
      
      // Process the page
      result = await this.processPage(url, page);
      
      // Cache the result if enabled
      if (this.options.cacheEnabled && !result.error) {
        await this.cacheService.set(url, result);
      }
      
      return result;
    } catch (error) {
      logger.error('Failed to crawl URL:', {
        url,
        error: error instanceof Error ? error.message : String(error)
      });
      
      const err = error instanceof Error ? error : new Error(String(error));
      result.error = {
        message: err.message,
        code: this.getErrorCode(err),
        retries: this.options.maxRetries
      };
      
      return result;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (error) {
          const err = error instanceof Error ? error : new Error('Failed to close page');
          logger.error('Error closing page', {
            url,
            error: err.message
          });
          // Only set the error if there isn't already one
          if (!result.error) {
            result.error = {
              message: 'Failed to close page',
              code: 'PAGE_CLOSE_ERROR',
              retries: 0
            };
          }
        }
      }
      if (browser) {
        try {
          await this.releaseBrowser(browser);
        } catch (error) {
          logger.error('Error releasing browser', {
            url,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }
  
  /**
   * Processes a page with optimizations
   */
  private async processPage(url: string, page: Page): Promise<PageResult> {
    const startTime = Date.now();
    let content = '';
    let links: string[] = [];
    let error: CrawlerError | undefined;
    let retryCount = 0;
    const depth = this.urlManager.getDepth(url) ?? 0;

    while (retryCount < this.options.maxRetries) {
      try {
        await page.goto(url, { timeout: this.options.timeout });
        content = await this.extractContent(page, url);
        links = await this.extractLinks(page, url);
        break;
      } catch (err) {
        retryCount++;
        const errMessage = err instanceof Error ? err.message : String(err);
        
        if (retryCount < this.options.maxRetries) {
          logger.warn('Page load failed, retrying', {
            url,
            retryCount,
            error: errMessage
          });
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));
          continue;
        }
        
        // On final retry, set the error
        error = {
          message: errMessage,
          code: this.getErrorCode(err instanceof Error ? err : new Error(errMessage)),
          retries: retryCount
        };
        
        // Log the final error
        logger.error('Failed to process page after max retries', {
          url,
          error: errMessage,
          retries: retryCount
        });
      }
    }

    const endTime = Date.now();
    const metrics = {
      loadTime: endTime - startTime,
      contentSize: content.length
    };

    return {
      url,
      content,
      links,
      depth,
      metrics,
      error
    };
  }
  
  /**
   * Extracts text content from the page with optimizations
   */
  private async extractContent(page: Page, url: string): Promise<string> {
    try {
      const content = await page.content();
      // Extract text content from HTML
      const text = content.replace(/<[^>]*>/g, '').trim();
      return text;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Content extraction failed');
      logger.error('Content extraction failed', {
        url,
        error: err.message
      });
      throw err;
    }
  }
  
  /**
   * Extracts links from the page with optimizations
   */
  private async extractLinks(page: Page, url: string): Promise<string[]> {
    try {
      const links = await page.$$eval('a[href]', (elements) => 
        elements.map(el => (el as HTMLAnchorElement).href)
          .filter(href => href && href.startsWith('http'))
      );
      return links;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Link extraction failed');
      logger.error('Link extraction failed', {
        url,
        error: err.message
      });
      throw err;
    }
  }

  /**
   * Starts crawling from a given URL using depth-first search with concurrency
   */
  async crawl(startUrl: string): Promise<PageResult[]> {
    const startTime = Date.now();
    logger.info('Starting crawl', { startUrl, options: this.options });
    
    // Initialize worker pool
    await this.initWorkerPool();
    
    // Queue the start URL
    this.urlManager.queueURL(startUrl, 0, 1);
    
    const results: PageResult[] = [];
    const processed = new Set<string>();
    
    try {
      // If respecting robots.txt, fetch and parse it first
      if (this.options.respectRobotsTxt) {
        const robotsTxtUrl = new URL('/robots.txt', startUrl).toString();
        await this.robotsTxtParser.fetchAndParse(robotsTxtUrl);
      }
      
      // Process URLs until queue is empty
      while (!this.isShuttingDown) {
        const nextUrl = this.urlManager.dequeueURL();
        if (!nextUrl) break;
        
        // Check if URL is allowed by robots.txt
        if (this.options.respectRobotsTxt && !this.robotsTxtParser.isAllowed(nextUrl)) {
          logger.debug('Skipping URL (robots.txt)', { url: nextUrl });
          results.push({
            url: nextUrl,
            content: '',
            links: [],
            depth: this.urlManager.getDepth(nextUrl) || 0,
            error: {
              message: 'URL blocked by robots.txt',
              code: 'ROBOTS_TXT_BLOCKED',
              retries: 0
            }
          });
          continue;
        }
        
        if (processed.has(nextUrl)) continue;
        processed.add(nextUrl);
        
        // Process the URL
        const result = await this.processUrlWithCache(nextUrl);
        results.push(result);
        
        // Queue discovered links if not at max depth
        if (result.depth < this.options.maxDepth) {
          for (const link of result.links) {
            this.urlManager.queueURL(link, result.depth + 1, 1);
          }
        }
      }
      
      // Update final metrics
      this.metrics.totalTime = Date.now() - startTime;
      this.metrics.pagesProcessed = results.length;
      this.metrics.averageLoadTime = this.metrics.totalTime / results.length;
      
      logger.info('Crawl completed', {
        startUrl,
        metrics: this.metrics
      });
      
      return results;
    } finally {
      await this.shutdown();
    }
  }
} 