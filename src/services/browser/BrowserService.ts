import { chromium, Browser, Page } from 'playwright'
import { logger } from '@/services/logging'
import { getBrowserConfig } from '@/lib/env'
import { BrowserServiceError } from './index'

interface BrowserInfo {
  browser: Browser
  pages: Page[]
  lastUsed: Date
  errorCount: number
  memoryUsage: number
  cpuUsage: number
  isHealthy: boolean
}

export class BrowserService {
  private static instance: BrowserService
  private browserPool: Map<string, BrowserInfo> = new Map()
  private readonly maxPoolSize: number
  private readonly pageTimeout: number
  private readonly requestTimeout: number
  private healthCheckInterval: NodeJS.Timeout | null = null

  private constructor() {
    const config = getBrowserConfig()
    this.maxPoolSize = config.poolSize
    this.pageTimeout = config.pageTimeout
    this.requestTimeout = config.requestTimeout
    this.startHealthCheck()
  }

  static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService()
    }
    return BrowserService.instance
  }

  private async updateResourceUsage(id: string, info: BrowserInfo): Promise<void> {
    try {
      // Get browser process info
      const contexts = await info.browser.contexts();
      const pagePromises = contexts.map(context => context.pages());
      const pages = await Promise.all(pagePromises);
      const totalPages = pages.flat().length;
      
      // Estimate resource usage based on page count
      // Each page typically uses ~100MB RAM and ~10% CPU
      info.memoryUsage = totalPages * 100; // Rough estimate: 100MB per page
      info.cpuUsage = totalPages * 10; // Rough estimate: 10% CPU per page

      // Log if exceeding thresholds
      if (info.memoryUsage > 1000) { // 1GB threshold
        logger.warn(`Browser ${id} memory usage high: ${info.memoryUsage.toFixed(2)}MB`);
      }
      if (info.cpuUsage > 50) { // 50% threshold
        logger.warn(`Browser ${id} CPU usage high: ${info.cpuUsage.toFixed(2)}%`);
      }
    } catch (error) {
      logger.error(`Failed to update resource usage for browser ${id}:`, error);
    }
  }

  private async runHealthCheck(): Promise<void> {
    for (const [id, info] of this.browserPool.entries()) {
      try {
        // Check if browser is responsive
        await info.browser.contexts()
        info.isHealthy = true
        info.errorCount = 0
        
        // Update resource usage
        await this.updateResourceUsage(id, info)
        
        // Check if browser needs recycling based on resource usage
        if (info.memoryUsage > 2000 || info.cpuUsage > 80) { // 2GB memory or 80% CPU threshold
          logger.warn(`Recycling browser ${id} due to high resource usage`);
          await this.removeBrowser(id)
        }
      } catch (error) {
        logger.warn(`Browser instance ${id} failed health check:`, error)
        info.isHealthy = false
        info.errorCount++
        
        if (info.errorCount >= 3) {
          await this.removeBrowser(id)
        }
      }
    }
  }

  private startHealthCheck(): void {
    // Run immediately
    this.runHealthCheck()
    
    // Then set up interval
    this.healthCheckInterval = setInterval(() => {
      this.runHealthCheck()
    }, 30000) // Health check every 30 seconds
  }

  private async removeBrowser(id: string): Promise<void> {
    const info = this.browserPool.get(id)
    if (info) {
      try {
        // Close all pages first
        for (const page of info.pages) {
          try {
            await page.context().close()
          } catch (error) {
            logger.error(`Failed to close page context:`, error)
          }
        }
        // Then close the browser
        await info.browser.close()
      } catch (error) {
        logger.error(`Failed to close browser ${id}:`, error)
      }
      this.browserPool.delete(id)
    }
  }

  private async createBrowser(): Promise<Browser> {
    try {
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ]
      })

      return browser
    } catch (error) {
      logger.error('Failed to create browser:', error)
      throw new BrowserServiceError('Failed to initialize browser')
    }
  }

  async getPage(): Promise<Page> {
    // Find available healthy browser
    for (const [id, info] of this.browserPool.entries()) {
      if (info.isHealthy && info.pages.length < 5) {
        info.lastUsed = new Date()
        const context = await info.browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        const page = await context.newPage()
        await page.setDefaultTimeout(this.requestTimeout)
        info.pages.push(page)
        return page
      }
    }

    // Create new browser if pool not full
    if (this.browserPool.size < this.maxPoolSize) {
      const browser = await this.createBrowser()
      const id = Math.random().toString(36).substring(7)
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      })
      const page = await context.newPage()
      await page.setDefaultTimeout(this.requestTimeout)
      
      this.browserPool.set(id, {
        browser,
        pages: [page],
        lastUsed: new Date(),
        errorCount: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        isHealthy: true
      })
      
      return page
    }

    // Wait for available browser
    return new Promise((resolve) => {
      const checkPool = setInterval(async () => {
        for (const [id, info] of this.browserPool.entries()) {
          if (info.isHealthy && info.pages.length < 5) {
            clearInterval(checkPool)
            info.lastUsed = new Date()
            const context = await info.browser.newContext({
              viewport: { width: 1920, height: 1080 },
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            })
            const page = await context.newPage()
            await page.setDefaultTimeout(this.requestTimeout)
            info.pages.push(page)
            resolve(page)
            return
          }
        }
      }, 1000)
    })
  }

  async releasePage(page: Page): Promise<void> {
    try {
      // Find the browser that owns this page
      for (const [id, info] of this.browserPool.entries()) {
        const pageIndex = info.pages.indexOf(page)
        if (pageIndex !== -1) {
          // Remove page from tracking array
          info.pages.splice(pageIndex, 1)
          
          // Close the context (which also closes the page)
          await page.context().close()
          
          return
        }
      }

      // If page not found in any browser, just close its context
      await page.context().close()
    } catch (error) {
      logger.error('Failed to release page:', error)
    }
  }

  async cleanup(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    try {
      await Promise.all(
        Array.from(this.browserPool.values()).map(async (info) => {
          try {
            await info.browser.close()
          } catch (error) {
            logger.error('Failed to close browser:', error)
          }
        })
      )
      this.browserPool.clear()
    } catch (error) {
      logger.error('Failed to cleanup BrowserService:', error)
    }
  }
} 