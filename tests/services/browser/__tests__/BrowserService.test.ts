import { BrowserService } from '@/services/browser/BrowserService'
import { Browser, Page } from 'playwright'
import { getBrowserConfig } from '@/lib/env'
import { logger } from '@/services/logging'
import { BrowserServiceError } from '@/services/browser'
import { chromium } from 'playwright'

jest.mock('@/lib/env', () => ({
  getBrowserConfig: jest.fn(() => ({
    poolSize: 2,
    pageTimeout: 30000,
    requestTimeout: 10000
  }))
}))

jest.mock('@/services/logging', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  }
}))

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn()
  }
}))

describe('BrowserService', () => {
  let browserService: BrowserService
  let pages: Page[] = []
  let mockBrowser: any
  let mockContext: any
  let mockPage: any

  beforeEach(() => {
    jest.clearAllMocks()
    // Reset singleton instance before each test
    // @ts-ignore - accessing private property for testing
    BrowserService.instance = undefined
    browserService = BrowserService.getInstance()

    // Mock browser, context and page
    mockPage = {
      setDefaultTimeout: jest.fn(),
      context: jest.fn(),
      goto: jest.fn(),
      evaluate: jest.fn()
    }

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn()
    }

    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      contexts: jest.fn().mockResolvedValue([mockContext]),
      close: jest.fn()
    }

    // Set up page context
    mockPage.context.mockReturnValue(mockContext)

    // Mock chromium.launch
    const { chromium } = require('playwright')
    chromium.launch.mockResolvedValue(mockBrowser)
  })

  afterEach(async () => {
    // Close all pages
    for (const page of pages) {
      try {
        await page.context().close()
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    pages = []
    await browserService.cleanup()
  })

  describe('Browser Pool Management', () => {
    it('should create browser instance when getting a page', async () => {
      const page = await browserService.getPage()
      pages.push(page as unknown as Page)
      expect(page).toBeDefined()
      expect(page.context()).toBeDefined()
      await browserService.releasePage(page as unknown as Page)
    })

    it('should respect maximum pool size', async () => {
      // Get pages up to pool size limit
      const pages = []
      for (let i = 0; i < 2; i++) {
        const page = await browserService.getPage()
        pages.push(page)
      }

      // Verify pool size
      // @ts-ignore - accessing private property for testing
      expect(browserService.browserPool.size).toBe(1)

      // Cleanup
      for (const page of pages) {
        await browserService.releasePage(page as unknown as Page)
      }
    })

    it('should reuse browser instances when available', async () => {
      // Get first page
      const page1 = await browserService.getPage()
      const context1 = page1.context()

      // Release page
      await browserService.releasePage(page1 as unknown as Page)

      // Get another page
      const page2 = await browserService.getPage()
      const context2 = page2.context()

      // Should reuse the same browser
      // @ts-ignore - accessing private property for testing
      expect(browserService.browserPool.size).toBe(1)

      await browserService.releasePage(page2 as unknown as Page)
    })

    it('should handle browser cleanup on shutdown', async () => {
      // Create some pages
      const pages = []
      for (let i = 0; i < 2; i++) {
        const page = await browserService.getPage()
        pages.push(page)
      }

      // Cleanup
      await browserService.cleanup()

      // Verify pool is empty
      // @ts-ignore - accessing private property for testing
      expect(browserService.browserPool.size).toBe(0)
    })

    it('should handle browser crashes', async () => {
      const page = await browserService.getPage()
      const context = page.context()

      // Simulate browser crash by forcefully closing context
      await context.close()

      // Try to use the page again - should get a new one
      const newPage = await browserService.getPage()
      expect(newPage).toBeDefined()
      expect(newPage.context()).toBeDefined()

      await browserService.releasePage(newPage as unknown as Page)
    })

    it('should handle resource monitoring', async () => {
      // Get a page and do some work
      const page = await browserService.getPage()
      mockPage.goto.mockResolvedValueOnce(undefined)
      await page.goto('about:blank')

      // Wait for resource update
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Get browser info
      // @ts-ignore - accessing private property for testing
      const browserInfo = Array.from(browserService.browserPool.values())[0]

      // Verify resource tracking
      expect(browserInfo.memoryUsage).toBeGreaterThanOrEqual(0)
      expect(browserInfo.cpuUsage).toBeGreaterThanOrEqual(0)

      await browserService.releasePage(page as unknown as Page)
    })

    it('should handle session timeouts', async () => {
      const page = await browserService.getPage()

      // Simulate long idle time
      // @ts-ignore - accessing private property for testing
      const browserInfo = Array.from(browserService.browserPool.values())[0]
      browserInfo.lastUsed = new Date(Date.now() - 3600000) // 1 hour ago

      // Mock contexts to fail
      mockBrowser.contexts.mockRejectedValueOnce(new Error('Browser not responding'))

      // Force health check
      // @ts-ignore - accessing private property for testing
      await browserService.runHealthCheck()

      // Verify browser was recycled
      expect(browserInfo.isHealthy).toBe(false)

      await browserService.releasePage(page as unknown as Page)
    })

    it('should rotate user agents', async () => {
      const page1 = await browserService.getPage()
      mockPage.evaluate.mockResolvedValueOnce('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124')
      const userAgent1 = await page1.evaluate(() => navigator.userAgent)

      await browserService.releasePage(page1 as unknown as Page)

      const page2 = await browserService.getPage()
      mockPage.evaluate.mockResolvedValueOnce('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124')
      const userAgent2 = await page2.evaluate(() => navigator.userAgent)

      expect(userAgent1).toBeDefined()
      expect(userAgent2).toBeDefined()

      await browserService.releasePage(page2 as unknown as Page)
    })

    it('should handle errors during page release', async () => {
      const page = await browserService.getPage()
      const mockError = new Error('Failed to close context')
      mockContext.close.mockRejectedValueOnce(mockError)

      await browserService.releasePage(page as unknown as Page)
      expect(logger.error).toHaveBeenCalledWith('Failed to release page:', mockError)
    })

    it('should handle errors during browser cleanup', async () => {
      const page = await browserService.getPage()
      const mockError = new Error('Failed to close browser')
      mockBrowser.close.mockRejectedValueOnce(mockError)

      await browserService.cleanup()
      expect(logger.error).toHaveBeenCalledWith('Failed to close browser:', mockError)
    })

    it('should handle errors during health check', async () => {
      const page = await browserService.getPage()
      const mockError = new Error('Failed health check')
      mockBrowser.contexts.mockRejectedValueOnce(mockError)

      // @ts-ignore - accessing private property for testing
      await browserService.runHealthCheck()
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('failed health check'), mockError)

      // @ts-ignore - accessing private property for testing
      const browserInfo = Array.from(browserService.browserPool.values())[0]
      expect(browserInfo.isHealthy).toBe(false)
      expect(browserInfo.errorCount).toBe(1)

      await browserService.releasePage(page as unknown as Page)
    })

    it('should handle errors during browser removal', async () => {
      const page = await browserService.getPage()
      const mockError = new Error('Failed to close browser')
      mockBrowser.close.mockRejectedValueOnce(mockError)

      // @ts-ignore - accessing private property for testing
      await browserService.removeBrowser(Array.from(browserService.browserPool.keys())[0])
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to close browser'), mockError)

      await browserService.releasePage(page as unknown as Page)
    })

    it('should handle errors during page context closure', async () => {
      const page = await browserService.getPage()
      const mockError = new Error('Failed to close page context')
      mockContext.close.mockRejectedValueOnce(mockError)

      // @ts-ignore - accessing private property for testing
      await browserService.removeBrowser(Array.from(browserService.browserPool.keys())[0])
      expect(logger.error).toHaveBeenCalledWith('Failed to close page context:', mockError)

      await browserService.releasePage(page as unknown as Page)
    })

    it('should handle waiting for available browser', async () => {
      // Fill up the pool
      const pages: Array<Page> = []
      for (let i = 0; i < 2; i++) {
        const page = await browserService.getPage()
        pages.push(page)
      }

      // Request another page (should wait)
      const pagePromise = browserService.getPage()

      // Release a page after a delay
      setTimeout(async () => {
        await browserService.releasePage(pages[0])
      }, 100)

      // Wait for the new page
      const newPage = await pagePromise
      expect(newPage).toBeDefined()

      // Cleanup
      await browserService.releasePage(newPage)
      for (const page of pages.slice(1)) {
        await browserService.releasePage(page)
      }
    })
  })

  describe('Browser Pool Configuration', () => {
    it('should initialize with correct pool size', () => {
      expect(browserService['maxPoolSize']).toBe(2)
    })

    it('should create browser instance when pool is not full', async () => {
      const page = await browserService.getPage()
      pages.push(page as unknown as Page)
      expect(page).toBeDefined()
      expect(chromium.launch).toHaveBeenCalledWith({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ]
      })
      await browserService.releasePage(page as unknown as Page)
    }, 60000)

    it('should reuse browser instance from pool', async () => {
      const page1 = await browserService.getPage()
      pages.push(page1 as unknown as Page)
      await browserService.releasePage(page1 as unknown as Page)
      const page2 = await browserService.getPage()
      pages.push(page2 as unknown as Page)
      expect(page2).toBeDefined()
      expect(chromium.launch).toHaveBeenCalledTimes(1)
      await browserService.releasePage(page2 as unknown as Page)
    }, 60000)

    it('should handle browser instance cleanup', async () => {
      const page = await browserService.getPage()
      pages.push(page as unknown as Page)
      await browserService.cleanup()
      expect(browserService['browserPool'].size).toBe(0)
      expect(mockBrowser.close).toHaveBeenCalled()
    }, 60000)

    it('should handle browser instance errors', async () => {
      const mockError = new BrowserServiceError('Failed to initialize browser')
      ;(chromium.launch as jest.Mock).mockRejectedValueOnce(mockError)
      
      await expect(browserService.getPage()).rejects.toThrow('Failed to initialize browser')
      expect(logger.error).toHaveBeenCalledWith('Failed to create browser:', mockError)
    }, 60000)

    it('should handle pool size limits', async () => {
      const pages: Page[] = []
      for (let i = 0; i < 6; i++) {
        try {
          const page = await browserService.getPage()
          pages.push(page)
        } catch (error: unknown) {
          if (error instanceof BrowserServiceError) {
            expect(error.message).toBe('Failed to initialize browser')
          } else {
            throw error
          }
        }
      }
      
      expect(browserService['browserPool'].size).toBeLessThanOrEqual(2)
      
      for (const page of pages) {
        await browserService.releasePage(page as unknown as Page)
      }
    }, 60000)
  })

  describe('Health Check', () => {
    it('should mark browser as unhealthy after failed health check', async () => {
      const service = BrowserService.getInstance()
      const mockBrowser = {
        contexts: jest.fn().mockRejectedValue(new Error('Health check failed')),
        close: jest.fn(),
        newContext: jest.fn().mockResolvedValue({
          newPage: jest.fn().mockResolvedValue({
            setDefaultTimeout: jest.fn(),
            context: jest.fn().mockReturnValue({ close: jest.fn() })
          })
        })
      }
      jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any)

      await service.getPage()
      
      // Get the browser info
      const browserInfo = Array.from(service['browserPool'].values())[0]
      expect(browserInfo).toBeDefined()
      
      // Run health check
      await service['runHealthCheck']()
      
      expect(browserInfo.isHealthy).toBe(false)
      expect(browserInfo.errorCount).toBe(1)
    })

    it('should remove browser after multiple health check failures', async () => {
      const service = BrowserService.getInstance()
      const mockBrowser = {
        contexts: jest.fn().mockRejectedValue(new Error('Health check failed')),
        close: jest.fn(),
        newContext: jest.fn().mockResolvedValue({
          newPage: jest.fn().mockResolvedValue({
            setDefaultTimeout: jest.fn(),
            context: jest.fn().mockReturnValue({ close: jest.fn() })
          })
        })
      }
      jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any)

      await service.getPage()
      
      // Get the browser info
      const browserInfo = Array.from(service['browserPool'].values())[0]
      expect(browserInfo).toBeDefined()
      
      // Run health check multiple times
      for (let i = 0; i < 3; i++) {
        await service['runHealthCheck']()
      }
      
      expect(service['browserPool'].size).toBe(0)
      expect(mockBrowser.close).toHaveBeenCalled()
    })
  })

  describe('Page Management', () => {
    it('should wait for available browser when pool is full', async () => {
      const service = BrowserService.getInstance()
      const mockPage = {
        setDefaultTimeout: jest.fn(),
        context: jest.fn().mockReturnValue({ close: jest.fn() })
      }
      const mockContext = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn()
      }
      const mockBrowser = {
        contexts: jest.fn().mockResolvedValue([]),
        close: jest.fn(),
        newContext: jest.fn().mockResolvedValue(mockContext)
      }
      jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any)

      // Create maximum pages for the browser
      const pages: Page[] = []
      for (let i = 0; i < 2; i++) {
        const page = await service.getPage()
        pages.push(page)
      }

      // Request one more page
      const pagePromise = service.getPage()
      
      // Simulate page release after a delay
      setTimeout(async () => {
        await service.releasePage(pages[0])
      }, 100)

      const page = await pagePromise
      expect(page).toBeDefined()
    })

    it('should handle page release errors gracefully', async () => {
      const service = BrowserService.getInstance()
      const mockPage = {
        setDefaultTimeout: jest.fn(),
        context: jest.fn().mockReturnValue({ close: jest.fn() })
      }
      const mockContext = {
        newPage: jest.fn().mockResolvedValue(mockPage),
        close: jest.fn()
      }
      const mockBrowser = {
        contexts: jest.fn().mockResolvedValue([]),
        close: jest.fn(),
        newContext: jest.fn().mockResolvedValue(mockContext)
      }
      jest.spyOn(chromium, 'launch').mockResolvedValue(mockBrowser as any)

      const page = await service.getPage()
      await service.releasePage(page)
      
      expect(page.context().close).toHaveBeenCalled()
    })
  })
}) 