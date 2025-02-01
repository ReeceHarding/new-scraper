// Mock the logger module first
jest.mock('../../../src/lib/logging', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

import { Browser, Page } from 'playwright';
import { WebsiteCrawler } from '../../../src/services/crawler/WebsiteCrawler';
import { BrowserService } from '../../../src/services/browser/BrowserService';
import { RobotsTxtParser } from '../../../src/services/crawler/RobotsTxtParser';
import { URLManager } from '../../../src/services/crawler/URLManager';
import { RateLimiter } from '../../../src/services/utils/RateLimiter';
import { CacheService } from '../../../src/services/cache/CacheService';
import { logger } from '../../../src/lib/logging';

// Mock all dependencies
jest.mock('../../../src/services/browser/BrowserService');
jest.mock('../../../src/services/crawler/RobotsTxtParser');
jest.mock('../../../src/services/crawler/URLManager');
jest.mock('../../../src/services/utils/RateLimiter');
jest.mock('../../../src/services/cache/CacheService');

// Add PageResult type
interface PageResult {
  url: string;
  content: string;
  links: string[];
  depth: number;
  error?: {
    message: string;
    code: string;
    retries?: number;
  };
  metrics?: {
    loadTime: number;
    size: number;
    resourceCount: number;
  };
}

describe('WebsiteCrawler', () => {
  describe('crawl', () => {
    let browserService: jest.Mocked<BrowserService>;
    let mockBrowser: jest.Mocked<Browser>;
    let mockPage: jest.Mocked<Page>;
    let mockURLManager: jest.Mocked<URLManager>;
    let mockRobotsTxtParser: jest.Mocked<RobotsTxtParser>;
    let mockRateLimiter: jest.Mocked<RateLimiter>;
    let mockCacheService: jest.Mocked<CacheService>;
    let crawler: WebsiteCrawler;

    beforeEach(() => {
      // Reset all mocks
      jest.clearAllMocks();

      // Mock Browser and Page
      mockPage = {
        goto: jest.fn().mockResolvedValue(null),
        content: jest.fn().mockResolvedValue('<html><body>Test content</body></html>'),
        $$eval: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
        setDefaultTimeout: jest.fn(),
        setDefaultNavigationTimeout: jest.fn(),
        on: jest.fn()
      } as unknown as jest.Mocked<Page>;

      mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn().mockResolvedValue(undefined)
      } as unknown as jest.Mocked<Browser>;

      // Mock BrowserService
      browserService = {
        getBrowser: jest.fn().mockResolvedValue(mockBrowser),
        releaseBrowser: jest.fn()
      } as unknown as jest.Mocked<BrowserService>;

      // Mock RobotsTxtParser
      mockRobotsTxtParser = {
        fetchAndParse: jest.fn(),
        isAllowed: jest.fn().mockReturnValue(true),
        getCrawlDelay: jest.fn().mockReturnValue(0)
      } as unknown as jest.Mocked<RobotsTxtParser>;

      // Mock URLManager
      mockURLManager = {
        queueURL: jest.fn(),
        dequeueURL: jest.fn().mockReturnValueOnce('https://example.com').mockReturnValueOnce(null),
        getDepth: jest.fn().mockReturnValue(0)
      } as unknown as jest.Mocked<URLManager>;

      // Mock RateLimiter
      mockRateLimiter = {
        wait: jest.fn(),
        lastRequestTime: 0,
        delayMs: 1000
      } as unknown as jest.Mocked<RateLimiter>;

      // Mock CacheService
      mockCacheService = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn(),
        getInstance: jest.fn().mockReturnThis()
      } as unknown as jest.Mocked<CacheService>;

      // Mock constructor dependencies
      (URLManager as jest.Mock).mockImplementation(() => mockURLManager);
      (RateLimiter as jest.Mock).mockImplementation(() => mockRateLimiter);
      (RobotsTxtParser as jest.Mock).mockImplementation(() => mockRobotsTxtParser);
      (CacheService.getInstance as jest.Mock).mockReturnValue(mockCacheService);

      // Create crawler instance
      crawler = new WebsiteCrawler(browserService, {
        maxDepth: 2,
        respectRobotsTxt: true,
        maxRetries: 3,
        retryDelay: 100,
        maxConcurrency: 1,
        cacheEnabled: true
      });
    });

    it('should crawl a single page with no links', async () => {
      mockURLManager.dequeueURL
        .mockReturnValueOnce('https://example.com')
        .mockReturnValueOnce(null);

      const results = await crawler.crawl('https://example.com');

      expect(results).toHaveLength(1);
      expect(results[0].url).toBe('https://example.com');
      expect(results[0].content).toBe('Test content');
      expect(results[0].links).toHaveLength(0);
      expect(results[0].error).toBeUndefined();
    });

    it('should respect robots.txt and log skipped URLs', async () => {
      mockRobotsTxtParser.isAllowed.mockReturnValue(false);
      mockURLManager.dequeueURL
        .mockReturnValueOnce('https://example.com/blocked')
        .mockReturnValueOnce(null);

      await crawler.crawl('https://example.com/blocked');

      expect(logger.debug).toHaveBeenCalledWith(
        'Skipping URL (robots.txt)',
        { url: 'https://example.com/blocked' }
      );
    });

    it('should extract and filter links correctly', async () => {
      mockPage.$$eval.mockResolvedValue([
        'https://example.com/page1',
        'https://example.com/page2'
      ]);

      mockURLManager.dequeueURL
        .mockReturnValueOnce('https://example.com')
        .mockReturnValueOnce(null);

      const results = await crawler.crawl('https://example.com');

      expect(results[0].links).toEqual([
        'https://example.com/page1',
        'https://example.com/page2'
      ]);
    });

    it('should handle page load timeouts with retries', async () => {
      const timeoutError = new Error('net::ERR_CONNECTION_TIMED_OUT');
      let retryCount = 0;

      mockPage.goto
        .mockImplementation(async () => {
          if (retryCount < 2) {
            retryCount++;
            throw timeoutError;
          }
          return null;
        });

      mockURLManager.dequeueURL
        .mockReturnValueOnce('https://example.com')
        .mockReturnValueOnce(null);

      const results = await crawler.crawl('https://example.com');

      expect(results[0].error).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith(
        'Page load failed, retrying',
        expect.objectContaining({
          url: 'https://example.com',
          retryCount: expect.any(Number),
          error: timeoutError.message
        })
      );
    });

    it('should handle page load failure after max retries', async () => {
      const timeoutError = new Error('net::ERR_CONNECTION_TIMED_OUT');

      mockPage.goto.mockRejectedValue(timeoutError);

      mockURLManager.dequeueURL
        .mockReturnValueOnce('https://example.com')
        .mockReturnValueOnce(null);

      const results = await crawler.crawl('https://example.com');

      expect(results[0].error).toBeDefined();
      expect(results[0].error).toEqual({
        message: timeoutError.message,
        code: 'TIMEOUT',
        retries: 3
      });
    });

    it('should handle content extraction errors', async () => {
      const extractionError = new Error('Content extraction failed');

      mockPage.content.mockRejectedValue(extractionError);

      mockURLManager.dequeueURL
        .mockReturnValueOnce('https://example.com')
        .mockReturnValueOnce(null);

      const results = await crawler.crawl('https://example.com');

      expect(results[0].content).toBe('');
      expect(logger.error).toHaveBeenCalledWith(
        'Content extraction failed',
        expect.objectContaining({
          url: 'https://example.com',
          error: extractionError.message
        })
      );
    });

    it('should handle link extraction errors', async () => {
      const extractionError = new Error('Link extraction failed');

      mockPage.$$eval.mockRejectedValue(extractionError);

      mockURLManager.dequeueURL
        .mockReturnValueOnce('https://example.com')
        .mockReturnValueOnce(null);

      const results = await crawler.crawl('https://example.com');

      expect(results[0].links).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Link extraction failed',
        expect.objectContaining({
          url: 'https://example.com',
          error: extractionError.message
        })
      );
    });

    it('should handle page close errors', async () => {
      const closeError = new Error('Failed to close page');
      mockBrowser.close.mockRejectedValue(closeError);

      mockURLManager.dequeueURL
        .mockReturnValueOnce('https://example.com')
        .mockReturnValueOnce(null);

      await crawler.crawl('https://example.com');

      expect(logger.error).toHaveBeenCalledWith(
        'Error closing page',
        expect.objectContaining({
          url: 'https://example.com',
          error: closeError.message
        })
      );
    });

    it('should handle various error types with correct error codes', async () => {
      const testCases = [
        {
          error: new Error('net::ERR_CONNECTION_REFUSED'),
          code: 'CONNECTION_REFUSED'
        },
        {
          error: new Error('net::ERR_NAME_NOT_RESOLVED'),
          code: 'DNS_ERROR'
        },
        {
          error: new Error('net::ERR_SSL_PROTOCOL_ERROR'),
          code: 'SSL_ERROR'
        },
        {
          error: new Error('net::ERR_TOO_MANY_REDIRECTS'),
          code: 'TOO_MANY_REDIRECTS'
        },
        {
          error: new Error('net::ERR_PROXY_CONNECTION_FAILED'),
          code: 'PROXY_ERROR'
        }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        mockPage.goto.mockRejectedValue(testCase.error);
        mockURLManager.dequeueURL
          .mockReturnValueOnce('https://example.com')
          .mockReturnValueOnce(null);

        const results = await crawler.crawl('https://example.com');

        expect(results[0].error).toBeDefined();
        expect(results[0].error?.code).toBe(testCase.code);
        expect(results[0].error?.message).toBe(testCase.error.message);
      }
    });
  });
}); 