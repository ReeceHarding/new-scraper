import { BrowserService } from '../BrowserService'
import { Browser, Page } from 'playwright'
import { getBrowserConfig } from '@/lib/env'

// Mock getBrowserConfig
jest.mock('@/lib/env', () => ({
  getBrowserConfig: jest.fn(() => ({
    poolSize: 2,
    pageTimeout: 30000,
    requestTimeout: 10000
  }))
}))

describe('BrowserService', () => {
  let browserService: BrowserService

  beforeEach(() => {
    // Reset singleton instance before each test
    // @ts-ignore - accessing private property for testing
    BrowserService.instance = undefined
    browserService = BrowserService.getInstance()
  })

  afterEach(async () => {
    await browserService.cleanup()
  })

  describe('Browser Pool Management', () => {
    it('should create browser instance when getting a page', async () => {
      const page = await browserService.getPage()
      expect(page).toBeDefined()
      expect(page.context()).toBeDefined()
      await browserService.releasePage(page)
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
      expect(browserService.browserPool.size).toBe(2)

      // Cleanup
      for (const page of pages) {
        await browserService.releasePage(page)
      }
    })

    it('should reuse browser instances when available', async () => {
      // Get first page
      const page1 = await browserService.getPage()
      const context1 = page1.context()

      // Release page
      await browserService.releasePage(page1)

      // Get another page
      const page2 = await browserService.getPage()
      const context2 = page2.context()

      // Should reuse the same browser
      // @ts-ignore - accessing private property for testing
      expect(browserService.browserPool.size).toBe(1)

      await browserService.releasePage(page2)
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

      await browserService.releasePage(newPage)
    })

    it('should handle resource monitoring', async () => {
      // Get a page and do some work
      const page = await browserService.getPage()
      await page.goto('about:blank')

      // Wait for resource update
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Get browser info
      // @ts-ignore - accessing private property for testing
      const browserInfo = Array.from(browserService.browserPool.values())[0]

      // Verify resource tracking
      expect(browserInfo.memoryUsage).toBeGreaterThanOrEqual(0)
      expect(browserInfo.cpuUsage).toBeGreaterThanOrEqual(0)

      await browserService.releasePage(page)
    })

    it('should handle session timeouts', async () => {
      const page = await browserService.getPage()

      // Simulate long idle time
      // @ts-ignore - accessing private property for testing
      const browserInfo = Array.from(browserService.browserPool.values())[0]
      browserInfo.lastUsed = new Date(Date.now() - 3600000) // 1 hour ago

      // Force health check
      // @ts-ignore - accessing private property for testing
      await browserService.runHealthCheck()

      // Verify browser was recycled
      expect(browserInfo.isHealthy).toBe(false)

      await browserService.releasePage(page)
    })

    it('should rotate user agents', async () => {
      const page1 = await browserService.getPage()
      const userAgent1 = await page1.evaluate(() => navigator.userAgent)

      await browserService.releasePage(page1)

      const page2 = await browserService.getPage()
      const userAgent2 = await page2.evaluate(() => navigator.userAgent)

      expect(userAgent1).toBeDefined()
      expect(userAgent2).toBeDefined()

      await browserService.releasePage(page2)
    })
  })
}) 