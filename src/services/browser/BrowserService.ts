import { Builder, WebDriver } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/chrome'
import { logger } from '@/services/logging'

export class BrowserService {
  private static instance: BrowserService
  private driverPool: WebDriver[] = []
  private readonly maxPoolSize: number = 5

  private constructor() {}

  static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService()
    }
    return BrowserService.instance
  }

  async getDriver(): Promise<WebDriver> {
    try {
      // Reuse an available driver from the pool
      const availableDriver = this.driverPool.pop()
      if (availableDriver) {
        return availableDriver
      }

      // Create a new driver if pool is not at max capacity
      if (this.driverPool.length < this.maxPoolSize) {
        const driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(
            new Options()
              .headless()
              .addArguments('--no-sandbox')
              .addArguments('--disable-dev-shm-usage')
          )
          .build()

        return driver
      }

      // Wait for a driver to become available
      return new Promise((resolve) => {
        const checkPool = setInterval(async () => {
          const driver = this.driverPool.pop()
          if (driver) {
            clearInterval(checkPool)
            resolve(driver)
          }
        }, 1000)
      })
    } catch (error) {
      logger.error('Failed to create WebDriver:', error)
      throw new Error('Failed to initialize browser')
    }
  }

  async releaseDriver(driver: WebDriver): Promise<void> {
    try {
      if (this.driverPool.length < this.maxPoolSize) {
        this.driverPool.push(driver)
      } else {
        await driver.quit()
      }
    } catch (error) {
      logger.error('Failed to release WebDriver:', error)
    }
  }

  async cleanup(): Promise<void> {
    try {
      await Promise.all(
        this.driverPool.map(async (driver) => {
          try {
            await driver.quit()
          } catch (error) {
            logger.error('Failed to quit WebDriver:', error)
          }
        })
      )
      this.driverPool = []
    } catch (error) {
      logger.error('Failed to cleanup BrowserService:', error)
    }
  }
} 