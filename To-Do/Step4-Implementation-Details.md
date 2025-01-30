# Step 4: Web Scraping and Data Processing

## 1. Scraping Infrastructure Setup

### 1.1 Selenium Grid Configuration
[] Configure Selenium Grid with Docker
   [] Update docker-compose.yml:
      ```yaml
      version: '3.8'
      services:
        selenium-hub:
          image: selenium/hub:4.16.1
          container_name: selenium-hub
          ports:
            - "4442:4442"
            - "4443:4443"
            - "4444:4444"
          environment:
            - GRID_MAX_SESSION=16
            - GRID_BROWSER_TIMEOUT=300
            - GRID_TIMEOUT=300

        chrome:
          image: selenium/node-chrome:4.16.1
          depends_on:
            - selenium-hub
          environment:
            - SE_EVENT_BUS_HOST=selenium-hub
            - SE_EVENT_BUS_PUBLISH_PORT=4442
            - SE_EVENT_BUS_SUBSCRIBE_PORT=4443
            - SE_NODE_MAX_SESSIONS=4
            - SE_NODE_OVERRIDE_MAX_SESSIONS=true
          volumes:
            - /dev/shm:/dev/shm
          deploy:
            replicas: 4

        firefox:
          image: selenium/node-firefox:4.16.1
          depends_on:
            - selenium-hub
          environment:
            - SE_EVENT_BUS_HOST=selenium-hub
            - SE_EVENT_BUS_PUBLISH_PORT=4442
            - SE_EVENT_BUS_SUBSCRIBE_PORT=4443
            - SE_NODE_MAX_SESSIONS=4
            - SE_NODE_OVERRIDE_MAX_SESSIONS=true
          volumes:
            - /dev/shm:/dev/shm
          deploy:
            replicas: 4
      ```

[] Configure environment variables
   [] Update .env.local:
      ```plaintext
      # Selenium Configuration
      SELENIUM_HUB_URL=http://localhost:4444/wd/hub
      SELENIUM_BROWSER=chrome
      SELENIUM_HEADLESS=true
      
      # Proxy Configuration (optional)
      PROXY_SERVER=
      PROXY_USERNAME=
      PROXY_PASSWORD=
      
      # Rate Limiting
      SCRAPING_RATE_LIMIT=100
      SCRAPING_CONCURRENT_LIMIT=10
      
      # Timeouts
      PAGE_LOAD_TIMEOUT=30000
      SCRIPT_TIMEOUT=30000
      IMPLICIT_WAIT_TIMEOUT=10000
      ```

   [] Add validation in src/utils/validateEnv.ts:
      ```typescript
      import { z } from 'zod'

      const envSchema = z.object({
        // ... existing validation ...
        SELENIUM_HUB_URL: z.string().url(),
        SELENIUM_BROWSER: z.enum(['chrome', 'firefox']),
        SELENIUM_HEADLESS: z.string().transform((val) => val === 'true'),
        SCRAPING_RATE_LIMIT: z.string().transform((val) => parseInt(val, 10)),
        SCRAPING_CONCURRENT_LIMIT: z.string().transform((val) => parseInt(val, 10)),
        PAGE_LOAD_TIMEOUT: z.string().transform((val) => parseInt(val, 10)),
        SCRIPT_TIMEOUT: z.string().transform((val) => parseInt(val, 10)),
        IMPLICIT_WAIT_TIMEOUT: z.string().transform((val) => parseInt(val, 10))
      })

      export function validateEnv() {
        const result = envSchema.safeParse(process.env)
        if (!result.success) {
          console.error('Invalid environment variables:', result.error.flatten())
          throw new Error('Invalid environment configuration')
        }
        return result.data
      }
      ```

### 1.2 Browser Management Service
[] Create browser management service
   [] Create file: src/services/browser/BrowserService.ts
      ```typescript
      import { Builder, WebDriver, Capabilities } from 'selenium-webdriver'
      import { Options as ChromeOptions } from 'selenium-webdriver/chrome'
      import { Options as FirefoxOptions } from 'selenium-webdriver/firefox'
      import { logger } from '@/services/logging'
      import { validateEnv } from '@/utils/validateEnv'

      export class BrowserService {
        private static instance: BrowserService
        private driverPool: WebDriver[] = []
        private inUseDrivers: Set<WebDriver> = new Set()
        private env = validateEnv()

        private constructor() {
          process.on('SIGINT', () => this.cleanup())
          process.on('SIGTERM', () => this.cleanup())
        }

        public static getInstance(): BrowserService {
          if (!BrowserService.instance) {
            BrowserService.instance = new BrowserService()
          }
          return BrowserService.instance
        }

        private async createDriver(): Promise<WebDriver> {
          try {
            const capabilities = new Capabilities()
            let options: ChromeOptions | FirefoxOptions

            if (this.env.SELENIUM_BROWSER === 'chrome') {
              options = new ChromeOptions()
              if (this.env.SELENIUM_HEADLESS) {
                options.addArguments('--headless')
              }
              options.addArguments(
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1920,1080'
              )
            } else {
              options = new FirefoxOptions()
              if (this.env.SELENIUM_HEADLESS) {
                options.addArguments('-headless')
              }
            }

            // Add proxy configuration if provided
            if (process.env.PROXY_SERVER) {
              options.setProxy({
                proxyType: 'manual',
                httpProxy: process.env.PROXY_SERVER,
                sslProxy: process.env.PROXY_SERVER,
                socksUsername: process.env.PROXY_USERNAME,
                socksPassword: process.env.PROXY_PASSWORD
              })
            }

            const driver = await new Builder()
              .usingServer(this.env.SELENIUM_HUB_URL)
              .withCapabilities(capabilities)
              .setChromeOptions(options)
              .build()

            // Configure timeouts
            await driver.manage().setTimeouts({
              pageLoad: this.env.PAGE_LOAD_TIMEOUT,
              script: this.env.SCRIPT_TIMEOUT,
              implicit: this.env.IMPLICIT_WAIT_TIMEOUT
            })

            return driver
          } catch (error) {
            logger.error('Failed to create WebDriver:', { error })
            throw new Error('Failed to create WebDriver')
          }
        }

        public async getDriver(): Promise<WebDriver> {
          // Check for available driver in pool
          const availableDriver = this.driverPool.find(
            (driver) => !this.inUseDrivers.has(driver)
          )

          if (availableDriver) {
            this.inUseDrivers.add(availableDriver)
            return availableDriver
          }

          // Create new driver if pool not at capacity
          if (this.driverPool.length < this.env.SCRAPING_CONCURRENT_LIMIT) {
            const newDriver = await this.createDriver()
            this.driverPool.push(newDriver)
            this.inUseDrivers.add(newDriver)
            return newDriver
          }

          // Wait for available driver
          return new Promise((resolve) => {
            const checkInterval = setInterval(async () => {
              const driver = this.driverPool.find(
                (driver) => !this.inUseDrivers.has(driver)
              )
              if (driver) {
                clearInterval(checkInterval)
                this.inUseDrivers.add(driver)
                resolve(driver)
              }
            }, 1000)
          })
        }

        public async releaseDriver(driver: WebDriver): Promise<void> {
          try {
            // Clear cookies and local storage
            await driver.manage().deleteAllCookies()
            await driver.executeScript('window.localStorage.clear();')
            await driver.executeScript('window.sessionStorage.clear();')

            // Reset to about:blank
            await driver.get('about:blank')

            this.inUseDrivers.delete(driver)
          } catch (error) {
            logger.error('Error releasing driver:', { error })
            // Remove from pool if cleanup fails
            this.driverPool = this.driverPool.filter((d) => d !== driver)
            this.inUseDrivers.delete(driver)
            await this.quitDriver(driver)
          }
        }

        private async quitDriver(driver: WebDriver): Promise<void> {
          try {
            await driver.quit()
          } catch (error) {
            logger.error('Error quitting driver:', { error })
          }
        }

        private async cleanup(): Promise<void> {
          logger.info('Cleaning up browser service...')
          await Promise.all(
            this.driverPool.map((driver) => this.quitDriver(driver))
          )
          this.driverPool = []
          this.inUseDrivers.clear()
        }

        public async healthCheck(): Promise<boolean> {
          try {
            const driver = await this.createDriver()
            await driver.get('about:blank')
            await this.quitDriver(driver)
            return true
          } catch (error) {
            logger.error('Health check failed:', { error })
            return false
          }
        }
      }

      export const browserService = BrowserService.getInstance()
      ```

### 1.3 Rate Limiting Service
[] Create rate limiting service
   [] Create file: src/services/scraping/RateLimitService.ts
      ```typescript
      import { logger } from '@/services/logging'
      import { validateEnv } from '@/utils/validateEnv'

      interface RateLimit {
        timestamp: number
        count: number
      }

      export class RateLimitService {
        private static instance: RateLimitService
        private rateLimits: Map<string, RateLimit> = new Map()
        private env = validateEnv()

        private constructor() {
          // Clean up old rate limits every minute
          setInterval(() => this.cleanup(), 60000)
        }

        public static getInstance(): RateLimitService {
          if (!RateLimitService.instance) {
            RateLimitService.instance = new RateLimitService()
          }
          return RateLimitService.instance
        }

        private cleanup(): void {
          const now = Date.now()
          for (const [domain, limit] of this.rateLimits.entries()) {
            if (now - limit.timestamp > 60000) {
              this.rateLimits.delete(domain)
            }
          }
        }

        private getDomain(url: string): string {
          try {
            return new URL(url).hostname
          } catch (error) {
            logger.error('Invalid URL:', { url, error })
            throw new Error('Invalid URL')
          }
        }

        public async checkRateLimit(url: string): Promise<void> {
          const domain = this.getDomain(url)
          const now = Date.now()
          const limit = this.rateLimits.get(domain)

          if (!limit) {
            this.rateLimits.set(domain, { timestamp: now, count: 1 })
            return
          }

          // Reset count if more than a minute has passed
          if (now - limit.timestamp > 60000) {
            this.rateLimits.set(domain, { timestamp: now, count: 1 })
            return
          }

          // Check if rate limit exceeded
          if (limit.count >= this.env.SCRAPING_RATE_LIMIT) {
            const waitTime = 60000 - (now - limit.timestamp)
            logger.warn('Rate limit exceeded:', { domain, waitTime })
            await new Promise((resolve) => setTimeout(resolve, waitTime))
            this.rateLimits.set(domain, { timestamp: Date.now(), count: 1 })
            return
          }

          // Increment count
          this.rateLimits.set(domain, {
            timestamp: limit.timestamp,
            count: limit.count + 1
          })
        }
      }

      export const rateLimitService = RateLimitService.getInstance()
      ```

### 1.4 Scraping Service
[] Create base scraping service
   [] Create file: src/services/scraping/ScrapingService.ts
      ```typescript
      import { WebDriver, By, until } from 'selenium-webdriver'
      import { browserService } from '@/services/browser/BrowserService'
      import { rateLimitService } from '@/services/scraping/RateLimitService'
      import { logger } from '@/services/logging'
      import { validateEnv } from '@/utils/validateEnv'

      export interface ScrapingResult<T> {
        data: T | null
        error?: string
        statusCode?: number
      }

      export abstract class ScrapingService<T> {
        protected env = validateEnv()

        protected abstract extractData(driver: WebDriver): Promise<T>
        protected abstract validate(data: T): boolean

        public async scrape(url: string): Promise<ScrapingResult<T>> {
          let driver: WebDriver | null = null

          try {
            // Check rate limit
            await rateLimitService.checkRateLimit(url)

            // Get driver from pool
            driver = await browserService.getDriver()

            // Navigate to URL
            await driver.get(url)

            // Wait for page load
            await driver.wait(
              until.elementLocated(By.tagName('body')),
              this.env.PAGE_LOAD_TIMEOUT
            )

            // Extract data
            const data = await this.extractData(driver)

            // Validate data
            if (!this.validate(data)) {
              throw new Error('Invalid data extracted')
            }

            return { data }
          } catch (error) {
            logger.error('Scraping error:', {
              url,
              error,
              message: error instanceof Error ? error.message : 'Unknown error'
            })

            return {
              data: null,
              error: error instanceof Error ? error.message : 'Unknown error',
              statusCode: this.getErrorStatusCode(error)
            }
          } finally {
            if (driver) {
              await browserService.releaseDriver(driver)
            }
          }
        }

        protected async waitForSelector(
          driver: WebDriver,
          selector: string,
          timeout: number = this.env.IMPLICIT_WAIT_TIMEOUT
        ): Promise<void> {
          try {
            await driver.wait(until.elementLocated(By.css(selector)), timeout)
          } catch (error) {
            throw new Error(`Timeout waiting for selector: ${selector}`)
          }
        }

        protected async getElementText(
          driver: WebDriver,
          selector: string
        ): Promise<string> {
          try {
            const element = await driver.findElement(By.css(selector))
            return element.getText()
          } catch (error) {
            throw new Error(`Failed to get text from selector: ${selector}`)
          }
        }

        protected async getElementAttribute(
          driver: WebDriver,
          selector: string,
          attribute: string
        ): Promise<string> {
          try {
            const element = await driver.findElement(By.css(selector))
            return element.getAttribute(attribute)
          } catch (error) {
            throw new Error(
              `Failed to get attribute ${attribute} from selector: ${selector}`
            )
          }
        }

        protected async executeScript<T>(
          driver: WebDriver,
          script: string,
          ...args: any[]
        ): Promise<T> {
          try {
            return await driver.executeScript<T>(script, ...args)
          } catch (error) {
            throw new Error('Failed to execute script')
          }
        }

        protected async scrollToBottom(driver: WebDriver): Promise<void> {
          await this.executeScript(
            driver,
            'window.scrollTo(0, document.body.scrollHeight);'
          )
          // Wait for any dynamic content to load
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }

        protected async isElementPresent(
          driver: WebDriver,
          selector: string
        ): Promise<boolean> {
          try {
            await driver.findElement(By.css(selector))
            return true
          } catch {
            return false
          }
        }

        private getErrorStatusCode(error: unknown): number {
          if (error instanceof Error) {
            if (error.message.includes('Timeout')) return 408
            if (error.message.includes('Invalid URL')) return 400
            if (error.message.includes('not found')) return 404
          }
          return 500
        }
      }
      ```

[] Create LinkedIn profile scraper
   [] Create file: src/services/scraping/LinkedInProfileScraper.ts
      ```typescript
      import { WebDriver } from 'selenium-webdriver'
      import { ScrapingService } from './ScrapingService'

      interface LinkedInProfile {
        name: string
        headline?: string
        location?: string
        company?: string
        position?: string
        education?: string[]
        experience?: Array<{
          title: string
          company: string
          duration: string
          description?: string
        }>
        skills?: string[]
        about?: string
        profileImageUrl?: string
      }

      export class LinkedInProfileScraper extends ScrapingService<LinkedInProfile> {
        protected async extractData(driver: WebDriver): Promise<LinkedInProfile> {
          // Wait for profile content to load
          await this.waitForSelector(driver, '.pv-top-card')

          const profile: LinkedInProfile = {
            name: await this.getElementText(driver, '.pv-top-card h1'),
            experience: []
          }

          // Extract basic info
          try {
            profile.headline = await this.getElementText(
              driver,
              '.pv-top-card .text-body-medium'
            )
          } catch {}

          try {
            profile.location = await this.getElementText(
              driver,
              '.pv-top-card .text-body-small[aria-label*="location"]'
            )
          } catch {}

          try {
            profile.profileImageUrl = await this.getElementAttribute(
              driver,
              '.pv-top-card .profile-photo-edit__preview',
              'src'
            )
          } catch {}

          // Extract about section
          if (await this.isElementPresent(driver, '#about')) {
            try {
              await this.waitForSelector(driver, '#about + div')
              profile.about = await this.getElementText(driver, '#about + div')
            } catch {}
          }

          // Extract experience
          if (await this.isElementPresent(driver, '#experience')) {
            try {
              await this.waitForSelector(driver, '#experience ~ .pvs-list')
              const experiences = await driver.findElements(
                By.css('#experience ~ .pvs-list > li')
              )

              for (const exp of experiences) {
                try {
                  const title = await exp.findElement(
                    By.css('.pvs-entity__title-text')
                  ).getText()
                  const company = await exp.findElement(
                    By.css('.pvs-entity__subtitle-text')
                  ).getText()
                  const duration = await exp.findElement(
                    By.css('.pvs-entity__date-range span:last-child')
                  ).getText()

                  let description
                  try {
                    description = await exp.findElement(
                      By.css('.pvs-entity__description')
                    ).getText()
                  } catch {}

                  profile.experience?.push({
                    title,
                    company,
                    duration,
                    description
                  })
                } catch (error) {
                  logger.warn('Failed to extract experience item:', { error })
                }
              }
            } catch {}
          }

          // Extract education
          if (await this.isElementPresent(driver, '#education')) {
            try {
              await this.waitForSelector(driver, '#education ~ .pvs-list')
              const educationItems = await driver.findElements(
                By.css('#education ~ .pvs-list > li')
              )

              profile.education = await Promise.all(
                educationItems.map(async (item) => {
                  try {
                    return await item
                      .findElement(By.css('.pvs-entity__title-text'))
                      .getText()
                  } catch {
                    return ''
                  }
                })
              ).then((items) => items.filter(Boolean))
            } catch {}
          }

          // Extract skills
          if (await this.isElementPresent(driver, '#skills')) {
            try {
              await this.waitForSelector(driver, '#skills ~ .pvs-list')
              const skillItems = await driver.findElements(
                By.css('#skills ~ .pvs-list > li')
              )

              profile.skills = await Promise.all(
                skillItems.map(async (item) => {
                  try {
                    return await item
                      .findElement(By.css('.pvs-entity__title-text'))
                      .getText()
                  } catch {
                    return ''
                  }
                })
              ).then((items) => items.filter(Boolean))
            } catch {}
          }

          return profile
        }

        protected validate(data: LinkedInProfile): boolean {
          return Boolean(data.name && data.name.length > 0)
        }
      }
      ```

## 2. Database Schema Implementation

### 2.1 Scraped Profiles Table
[] Create scraped_profiles table migration
   [] Create new migration file:
      ```sql
      -- migration_name: create_scraped_profiles_table
      CREATE TABLE IF NOT EXISTS public.scraped_profiles (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('linkedin')),
        raw_data JSONB NOT NULL,
        processed_data JSONB,
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        error TEXT,
        last_scraped_at TIMESTAMPTZ,
        next_scrape_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by UUID NOT NULL REFERENCES auth.users(id),
        updated_by UUID NOT NULL REFERENCES auth.users(id),
        CONSTRAINT unique_org_url UNIQUE (org_id, url)
      );

      -- Add indexes
      CREATE INDEX idx_scraped_profiles_org_id ON public.scraped_profiles(org_id);
      CREATE INDEX idx_scraped_profiles_status ON public.scraped_profiles(status);
      CREATE INDEX idx_scraped_profiles_source ON public.scraped_profiles(source);
      CREATE INDEX idx_scraped_profiles_next_scrape ON public.scraped_profiles(next_scrape_at)
        WHERE status != 'completed';

      -- Add RLS policies
      ALTER TABLE public.scraped_profiles ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Scraped profiles are viewable by organization members"
        ON public.scraped_profiles
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = scraped_profiles.org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Scraped profiles are insertable by organization members"
        ON public.scraped_profiles
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Scraped profiles are updatable by organization members"
        ON public.scraped_profiles
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = scraped_profiles.org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Scraped profiles are deletable by organization members"
        ON public.scraped_profiles
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = scraped_profiles.org_id
              AND p.id = auth.uid()
          )
        );

      -- Add triggers
      CREATE TRIGGER update_scraped_profiles_updated_at
        BEFORE UPDATE ON public.scraped_profiles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      -- Add audit logging
      CREATE TABLE IF NOT EXISTS audit.scraped_profiles_log (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        profile_id UUID NOT NULL,
        action TEXT NOT NULL,
        old_data JSONB,
        new_data JSONB,
        changed_by UUID NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION audit_scraped_profiles_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO audit.scraped_profiles_log
          (profile_id, action, old_data, new_data, changed_by)
        VALUES
          (COALESCE(NEW.id, OLD.id),
           TG_OP,
           CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
           CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
           auth.uid());
        RETURN NULL;
      END;
      $$ language 'plpgsql' SECURITY DEFINER;

      CREATE TRIGGER audit_scraped_profiles_changes
        AFTER INSERT OR UPDATE OR DELETE ON public.scraped_profiles
        FOR EACH ROW
        EXECUTE FUNCTION audit_scraped_profiles_changes();
      ```

### 2.2 Scraping Jobs Table
[] Create scraping_jobs table migration
   [] Create new migration file:
      ```sql
      -- migration_name: create_scraping_jobs_table
      CREATE TABLE IF NOT EXISTS public.scraping_jobs (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        source TEXT NOT NULL CHECK (source IN ('linkedin')),
        status TEXT NOT NULL CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        schedule JSONB,
        total_profiles INTEGER NOT NULL DEFAULT 0,
        processed_profiles INTEGER NOT NULL DEFAULT 0,
        failed_profiles INTEGER NOT NULL DEFAULT 0,
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by UUID NOT NULL REFERENCES auth.users(id),
        updated_by UUID NOT NULL REFERENCES auth.users(id)
      );

      -- Add indexes
      CREATE INDEX idx_scraping_jobs_org_id ON public.scraping_jobs(org_id);
      CREATE INDEX idx_scraping_jobs_status ON public.scraping_jobs(status);
      CREATE INDEX idx_scraping_jobs_next_run ON public.scraping_jobs(next_run_at)
        WHERE status IN ('scheduled', 'running');

      -- Add RLS policies
      ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Scraping jobs are viewable by organization members"
        ON public.scraping_jobs
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = scraping_jobs.org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Scraping jobs are insertable by organization members"
        ON public.scraping_jobs
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Scraping jobs are updatable by organization members"
        ON public.scraping_jobs
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = scraping_jobs.org_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Scraping jobs are deletable by organization members"
        ON public.scraping_jobs
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.org_id = scraping_jobs.org_id
              AND p.id = auth.uid()
          )
        );

      -- Add triggers
      CREATE TRIGGER update_scraping_jobs_updated_at
        BEFORE UPDATE ON public.scraping_jobs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      -- Add audit logging
      CREATE TABLE IF NOT EXISTS audit.scraping_jobs_log (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        job_id UUID NOT NULL,
        action TEXT NOT NULL,
        old_data JSONB,
        new_data JSONB,
        changed_by UUID NOT NULL,
        changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE OR REPLACE FUNCTION audit_scraping_jobs_changes()
      RETURNS TRIGGER AS $$
      BEGIN
        INSERT INTO audit.scraping_jobs_log
          (job_id, action, old_data, new_data, changed_by)
        VALUES
          (COALESCE(NEW.id, OLD.id),
           TG_OP,
           CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
           CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
           auth.uid());
        RETURN NULL;
      END;
      $$ language 'plpgsql' SECURITY DEFINER;

      CREATE TRIGGER audit_scraping_jobs_changes
        AFTER INSERT OR UPDATE OR DELETE ON public.scraping_jobs
        FOR EACH ROW
        EXECUTE FUNCTION audit_scraping_jobs_changes();
      ```

### 2.3 Job Profiles Table
[] Create job_profiles table migration
   [] Create new migration file:
      ```sql
      -- migration_name: create_job_profiles_table
      CREATE TABLE IF NOT EXISTS public.job_profiles (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        job_id UUID NOT NULL REFERENCES public.scraping_jobs(id) ON DELETE CASCADE,
        profile_id UUID NOT NULL REFERENCES public.scraped_profiles(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        error TEXT,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT unique_job_profile UNIQUE (job_id, profile_id)
      );

      -- Add indexes
      CREATE INDEX idx_job_profiles_job_id ON public.job_profiles(job_id);
      CREATE INDEX idx_job_profiles_profile_id ON public.job_profiles(profile_id);
      CREATE INDEX idx_job_profiles_status ON public.job_profiles(status);

      -- Add RLS policies
      ALTER TABLE public.job_profiles ENABLE ROW LEVEL SECURITY;

      CREATE POLICY "Job profiles are viewable by organization members"
        ON public.job_profiles
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM public.scraping_jobs j
            JOIN public.profiles p ON p.org_id = j.org_id
            WHERE j.id = job_profiles.job_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Job profiles are insertable by organization members"
        ON public.job_profiles
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.scraping_jobs j
            JOIN public.profiles p ON p.org_id = j.org_id
            WHERE j.id = job_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Job profiles are updatable by organization members"
        ON public.job_profiles
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM public.scraping_jobs j
            JOIN public.profiles p ON p.org_id = j.org_id
            WHERE j.id = job_profiles.job_id
              AND p.id = auth.uid()
          )
        );

      CREATE POLICY "Job profiles are deletable by organization members"
        ON public.job_profiles
        FOR DELETE
        USING (
          EXISTS (
            SELECT 1 FROM public.scraping_jobs j
            JOIN public.profiles p ON p.org_id = j.org_id
            WHERE j.id = job_profiles.job_id
              AND p.id = auth.uid()
          )
        );

      -- Add triggers
      CREATE TRIGGER update_job_profiles_updated_at
        BEFORE UPDATE ON public.job_profiles
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      ```

## 3. Job Management Implementation

### 3.1 Job Management Service
[] Create job management service
   [] Create file: src/services/scraping/JobService.ts
      ```typescript
      import { supabaseClient } from '@/lib/supabase/client'
      import { LinkedInProfileScraper } from './LinkedInProfileScraper'
      import { logger } from '@/services/logging'
      import { Database } from '@/types/supabase'

      type ScrapingJob = Database['public']['Tables']['scraping_jobs']['Row']
      type JobProfile = Database['public']['Tables']['job_profiles']['Row']
      type ScrapedProfile = Database['public']['Tables']['scraped_profiles']['Row']

      export class JobService {
        constructor(private readonly orgId: string) {}

        async createJob({
          name,
          description,
          source,
          config,
          schedule
        }: {
          name: string
          description?: string
          source: 'linkedin'
          config: Record<string, any>
          schedule?: Record<string, any>
        }): Promise<ScrapingJob> {
          try {
            const { data: job, error } = await supabaseClient
              .from('scraping_jobs')
              .insert({
                org_id: this.orgId,
                name,
                description,
                source,
                status: 'draft',
                config,
                schedule,
                created_by: (await supabaseClient.auth.getUser()).data.user!.id,
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .select()
              .single()

            if (error) throw error

            logger.info('Scraping job created:', {
              jobId: job.id,
              orgId: this.orgId
            })

            return job
          } catch (error) {
            logger.error('Failed to create scraping job:', {
              orgId: this.orgId,
              error
            })
            throw new Error('Failed to create scraping job')
          }
        }

        async addProfiles(
          jobId: string,
          urls: string[]
        ): Promise<void> {
          try {
            // First, create or get scraped profiles
            const profiles: ScrapedProfile[] = []
            for (const url of urls) {
              const { data, error } = await supabaseClient
                .from('scraped_profiles')
                .upsert({
                  org_id: this.orgId,
                  url,
                  source: 'linkedin',
                  status: 'pending',
                  raw_data: {},
                  created_by: (await supabaseClient.auth.getUser()).data.user!.id,
                  updated_by: (await supabaseClient.auth.getUser()).data.user!.id
                })
                .select()
                .single()

              if (error) throw error
              profiles.push(data)
            }

            // Then, create job_profiles entries
            const { error } = await supabaseClient
              .from('job_profiles')
              .insert(
                profiles.map((profile) => ({
                  job_id: jobId,
                  profile_id: profile.id,
                  status: 'pending'
                }))
              )

            if (error) throw error

            // Update job total_profiles count
            await supabaseClient
              .from('scraping_jobs')
              .update({
                total_profiles: profiles.length,
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', jobId)

            logger.info('Profiles added to job:', {
              jobId,
              count: profiles.length
            })
          } catch (error) {
            logger.error('Failed to add profiles to job:', {
              jobId,
              error
            })
            throw new Error('Failed to add profiles to job')
          }
        }

        async startJob(jobId: string): Promise<void> {
          try {
            // Update job status
            const { error: updateError } = await supabaseClient
              .from('scraping_jobs')
              .update({
                status: 'running',
                started_at: new Date().toISOString(),
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', jobId)
              .eq('status', 'draft')

            if (updateError) throw updateError

            // Start processing profiles
            void this.processProfiles(jobId)

            logger.info('Scraping job started:', {
              jobId,
              orgId: this.orgId
            })
          } catch (error) {
            logger.error('Failed to start scraping job:', {
              jobId,
              error
            })
            throw new Error('Failed to start scraping job')
          }
        }

        private async processProfiles(jobId: string): Promise<void> {
          const scraper = new LinkedInProfileScraper()
          let processedCount = 0
          let failedCount = 0

          try {
            while (true) {
              // Get next batch of pending profiles
              const { data: jobProfiles, error: profilesError } = await supabaseClient
                .from('job_profiles')
                .select('*, profile:scraped_profiles(*)')
                .eq('job_id', jobId)
                .eq('status', 'pending')
                .order('created_at', { ascending: true })
                .limit(10)

              if (profilesError) throw profilesError
              if (!jobProfiles?.length) break

              // Process each profile
              for (const jobProfile of jobProfiles) {
                try {
                  // Update status to processing
                  await supabaseClient
                    .from('job_profiles')
                    .update({ status: 'processing' })
                    .eq('id', jobProfile.id)

                  // Scrape profile
                  const result = await scraper.scrape(jobProfile.profile.url)

                  if (result.data) {
                    // Update scraped profile
                    await supabaseClient
                      .from('scraped_profiles')
                      .update({
                        raw_data: result.data,
                        processed_data: result.data,
                        status: 'completed',
                        last_scraped_at: new Date().toISOString(),
                        updated_by: (await supabaseClient.auth.getUser()).data.user!.id
                      })
                      .eq('id', jobProfile.profile.id)

                    // Update job profile
                    await supabaseClient
                      .from('job_profiles')
                      .update({
                        status: 'completed',
                        processed_at: new Date().toISOString()
                      })
                      .eq('id', jobProfile.id)

                    processedCount++
                  } else {
                    throw new Error(result.error || 'Failed to scrape profile')
                  }
                } catch (error) {
                  // Update job profile with error
                  await supabaseClient
                    .from('job_profiles')
                    .update({
                      status: 'failed',
                      error: error instanceof Error ? error.message : 'Unknown error'
                    })
                    .eq('id', jobProfile.id)

                  failedCount++
                  logger.error('Failed to process profile:', {
                    jobId,
                    profileId: jobProfile.profile.id,
                    error
                  })
                }

                // Update job progress
                await supabaseClient
                  .from('scraping_jobs')
                  .update({
                    processed_profiles: processedCount,
                    failed_profiles: failedCount,
                    updated_by: (await supabaseClient.auth.getUser()).data.user!.id
                  })
                  .eq('id', jobId)
              }
            }

            // Update job status to completed
            await supabaseClient
              .from('scraping_jobs')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', jobId)

            logger.info('Scraping job completed:', {
              jobId,
              processedCount,
              failedCount
            })
          } catch (error) {
            // Update job status to failed
            await supabaseClient
              .from('scraping_jobs')
              .update({
                status: 'failed',
                last_error: error instanceof Error ? error.message : 'Unknown error',
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', jobId)

            logger.error('Job processing failed:', {
              jobId,
              error
            })
          }
        }

        async pauseJob(jobId: string): Promise<void> {
          try {
            const { error } = await supabaseClient
              .from('scraping_jobs')
              .update({
                status: 'paused',
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', jobId)
              .eq('status', 'running')

            if (error) throw error

            logger.info('Scraping job paused:', {
              jobId,
              orgId: this.orgId
            })
          } catch (error) {
            logger.error('Failed to pause scraping job:', {
              jobId,
              error
            })
            throw new Error('Failed to pause scraping job')
          }
        }

        async resumeJob(jobId: string): Promise<void> {
          try {
            const { error } = await supabaseClient
              .from('scraping_jobs')
              .update({
                status: 'running',
                updated_by: (await supabaseClient.auth.getUser()).data.user!.id
              })
              .eq('id', jobId)
              .eq('status', 'paused')

            if (error) throw error

            // Resume processing profiles
            void this.processProfiles(jobId)

            logger.info('Scraping job resumed:', {
              jobId,
              orgId: this.orgId
            })
          } catch (error) {
            logger.error('Failed to resume scraping job:', {
              jobId,
              error
            })
            throw new Error('Failed to resume scraping job')
          }
        }

        async getJobStats(jobId: string): Promise<{
          total: number
          pending: number
          processing: number
          completed: number
          failed: number
        }> {
          try {
            const { data: stats, error } = await supabaseClient
              .from('job_profiles')
              .select('status', { count: 'exact' })
              .eq('job_id', jobId)

            if (error) throw error

            return {
              total: stats.length,
              pending: stats.filter((p) => p.status === 'pending').length,
              processing: stats.filter((p) => p.status === 'processing').length,
              completed: stats.filter((p) => p.status === 'completed').length,
              failed: stats.filter((p) => p.status === 'failed').length
            }
          } catch (error) {
            logger.error('Failed to get job stats:', {
              jobId,
              error
            })
            throw new Error('Failed to get job stats')
          }
        }
      }
      ```

### 3.2 Job Management UI
[] Create jobs list page
   [] Create file: src/pages/scraping/jobs/index.tsx
      ```typescript
      import { useState, useEffect } from 'react'
      import { useRouter } from 'next/router'
      import ProtectedRoute from '@/components/auth/ProtectedRoute'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'
      import { Database } from '@/types/supabase'
      import { format } from 'date-fns'

      type ScrapingJob = Database['public']['Tables']['scraping_jobs']['Row']

      export default function JobsPage() {
        const router = useRouter()
        const supabase = useSupabaseClient<Database>()
        const [jobs, setJobs] = useState<ScrapingJob[]>([])
        const [isLoading, setIsLoading] = useState(true)

        useEffect(() => {
          async function loadJobs() {
            try {
              const { data, error } = await supabase
                .from('scraping_jobs')
                .select('*')
                .order('created_at', { ascending: false })

              if (error) throw error
              setJobs(data || [])
            } catch (error) {
              console.error('Error loading jobs:', error)
            } finally {
              setIsLoading(false)
            }
          }

          void loadJobs()
        }, [supabase])

        return (
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold text-gray-900">
                      Scraping Jobs
                    </h1>
                    <button
                      onClick={() => router.push('/scraping/jobs/new')}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Create Job
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="loader">Loading...</div>
                    </div>
                  ) : jobs.length === 0 ? (
                    <div className="text-center py-12">
                      <h3 className="text-lg font-medium text-gray-900">
                        No scraping jobs yet
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Get started by creating your first scraping job.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white shadow overflow-hidden sm:rounded-md">
                      <ul className="divide-y divide-gray-200">
                        {jobs.map((job) => (
                          <li key={job.id}>
                            <a
                              href={`/scraping/jobs/${job.id}`}
                              className="block hover:bg-gray-50"
                            >
                              <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-indigo-600 truncate">
                                      {job.name}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-500">
                                      {job.description || 'No description'}
                                    </p>
                                  </div>
                                  <div className="ml-4 flex-shrink-0 flex">
                                    <p
                                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                        job.status
                                      )}`}
                                    >
                                      {job.status}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-2 sm:flex sm:justify-between">
                                  <div className="sm:flex">
                                    <p className="flex items-center text-sm text-gray-500">
                                      {job.source} • {job.total_profiles} profiles
                                    </p>
                                  </div>
                                  <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                    <p>
                                      Created{' '}
                                      {format(
                                        new Date(job.created_at),
                                        'MMM d, yyyy'
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ProtectedRoute>
        )
      }

      function getStatusColor(status: string): string {
        switch (status) {
          case 'draft':
            return 'bg-gray-100 text-gray-800'
          case 'scheduled':
            return 'bg-yellow-100 text-yellow-800'
          case 'running':
            return 'bg-green-100 text-green-800'
          case 'paused':
            return 'bg-orange-100 text-orange-800'
          case 'completed':
            return 'bg-blue-100 text-blue-800'
          case 'failed':
            return 'bg-red-100 text-red-800'
          default:
            return 'bg-gray-100 text-gray-800'
        }
      }
      ```

[] Create job creation page
   [] Create file: src/pages/scraping/jobs/new.tsx
      ```typescript
      import { useState } from 'react'
      import { useRouter } from 'next/router'
      import { useForm } from 'react-hook-form'
      import { zodResolver } from '@hookform/resolvers/zod'
      import { z } from 'zod'
      import ProtectedRoute from '@/components/auth/ProtectedRoute'
      import { JobService } from '@/services/scraping/JobService'
      import { useAuth } from '@/contexts/AuthContext'

      const jobSchema = z.object({
        name: z.string().min(1, 'Job name is required'),
        description: z.string().optional(),
        source: z.literal('linkedin'),
        urls: z.array(z.string().url('Invalid URL')).min(1, 'At least one URL is required'),
        config: z.object({
          waitBetweenRequests: z.number().min(1000).max(10000),
          maxRetries: z.number().min(1).max(5)
        })
      })

      type JobForm = z.infer<typeof jobSchema>

      export default function NewJobPage() {
        const router = useRouter()
        const { organization } = useAuth()
        const [isSubmitting, setIsSubmitting] = useState(false)
        const [error, setError] = useState<string | null>(null)

        const {
          register,
          handleSubmit,
          formState: { errors }
        } = useForm<JobForm>({
          resolver: zodResolver(jobSchema),
          defaultValues: {
            source: 'linkedin',
            config: {
              waitBetweenRequests: 2000,
              maxRetries: 3
            }
          }
        })

        const onSubmit = async (data: JobForm) => {
          if (!organization) return

          setIsSubmitting(true)
          setError(null)

          try {
            const jobService = new JobService(organization.id)
            
            // Create job
            const job = await jobService.createJob({
              name: data.name,
              description: data.description,
              source: data.source,
              config: data.config
            })

            // Add profiles
            await jobService.addProfiles(job.id, data.urls)

            router.push(`/scraping/jobs/${job.id}`)
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to create job')
          } finally {
            setIsSubmitting(false)
          }
        }

        return (
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                  <div className="max-w-3xl mx-auto">
                    <h1 className="text-2xl font-semibold text-gray-900 mb-6">
                      Create New Scraping Job
                    </h1>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Job Name
                        </label>
                        <input
                          type="text"
                          id="name"
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          {...register('name')}
                        />
                        {errors.name && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.name.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label
                          htmlFor="description"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Description
                        </label>
                        <textarea
                          id="description"
                          rows={3}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          {...register('description')}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="urls"
                          className="block text-sm font-medium text-gray-700"
                        >
                          Profile URLs (one per line)
                        </label>
                        <textarea
                          id="urls"
                          rows={5}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                          {...register('urls')}
                          onChange={(e) => {
                            const urls = e.target.value
                              .split('\n')
                              .map((url) => url.trim())
                              .filter(Boolean)
                            register('urls').onChange({
                              target: {
                                value: urls
                              }
                            })
                          }}
                        />
                        {errors.urls && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.urls.message}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="waitBetweenRequests"
                            className="block text-sm font-medium text-gray-700"
                          >
                            Wait Between Requests (ms)
                          </label>
                          <input
                            type="number"
                            id="waitBetweenRequests"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            {...register('config.waitBetweenRequests', {
                              valueAsNumber: true
                            })}
                          />
                          {errors.config?.waitBetweenRequests && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors.config.waitBetweenRequests.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label
                            htmlFor="maxRetries"
                            className="block text-sm font-medium text-gray-700"
                          >
                            Max Retries
                          </label>
                          <input
                            type="number"
                            id="maxRetries"
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            {...register('config.maxRetries', {
                              valueAsNumber: true
                            })}
                          />
                          {errors.config?.maxRetries && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors.config.maxRetries.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {error && (
                        <div className="rounded-md bg-red-50 p-4">
                          <div className="text-sm text-red-700">{error}</div>
                        </div>
                      )}

                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => router.back()}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          {isSubmitting ? 'Creating...' : 'Create Job'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </ProtectedRoute>
        )
      }
      ```

[] Create job details page
   [] Create file: src/pages/scraping/jobs/[id].tsx
      ```typescript
      import { useState, useEffect } from 'react'
      import { useRouter } from 'next/router'
      import ProtectedRoute from '@/components/auth/ProtectedRoute'
      import { useSupabaseClient } from '@supabase/auth-helpers-react'
      import { Database } from '@/types/supabase'
      import { format } from 'date-fns'
      import { JobService } from '@/services/scraping/JobService'
      import { useAuth } from '@/contexts/AuthContext'

      type ScrapingJob = Database['public']['Tables']['scraping_jobs']['Row']
      type JobProfile = Database['public']['Tables']['job_profiles']['Row'] & {
        profile: Database['public']['Tables']['scraped_profiles']['Row']
      }

      interface JobStats {
        total: number
        pending: number
        processing: number
        completed: number
        failed: number
      }

      export default function JobDetailsPage() {
        const router = useRouter()
        const { id } = router.query
        const { organization } = useAuth()
        const supabase = useSupabaseClient<Database>()
        const [job, setJob] = useState<ScrapingJob | null>(null)
        const [profiles, setProfiles] = useState<JobProfile[]>([])
        const [stats, setStats] = useState<JobStats | null>(null)
        const [isLoading, setIsLoading] = useState(true)
        const [error, setError] = useState<string | null>(null)
        const [isActionInProgress, setIsActionInProgress] = useState(false)

        useEffect(() => {
          if (id && organization) {
            void loadJobData()
          }
        }, [id, organization])

        async function loadJobData() {
          try {
            // Load job details
            const { data: job, error: jobError } = await supabase
              .from('scraping_jobs')
              .select('*')
              .eq('id', id)
              .single()

            if (jobError) throw jobError
            setJob(job)

            // Load profiles
            const { data: profiles, error: profilesError } = await supabase
              .from('job_profiles')
              .select('*, profile:scraped_profiles(*)')
              .eq('job_id', id)
              .order('created_at', { ascending: true })

            if (profilesError) throw profilesError
            setProfiles(profiles || [])

            // Load stats
            const jobService = new JobService(organization.id)
            const stats = await jobService.getJobStats(id as string)
            setStats(stats)
          } catch (error) {
            console.error('Error loading job data:', error)
            setError('Failed to load job data')
          } finally {
            setIsLoading(false)
          }
        }

        async function handleAction(action: 'start' | 'pause' | 'resume') {
          if (!job || !organization) return

          setIsActionInProgress(true)
          setError(null)

          try {
            const jobService = new JobService(organization.id)

            switch (action) {
              case 'start':
                await jobService.startJob(job.id)
                break
              case 'pause':
                await jobService.pauseJob(job.id)
                break
              case 'resume':
                await jobService.resumeJob(job.id)
                break
            }

            await loadJobData()
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : `Failed to ${action} job`
            )
          } finally {
            setIsActionInProgress(false)
          }
        }

        if (isLoading) {
          return (
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="loader">Loading...</div>
              </div>
            </ProtectedRoute>
          )
        }

        if (!job) {
          return (
            <ProtectedRoute>
              <div className="min-h-screen bg-gray-100">
                <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                  <div className="px-4 py-6 sm:px-0">
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-gray-900">
                        Job not found
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        The job you're looking for doesn't exist or you don't
                        have access to it.
                      </p>
                      <button
                        onClick={() => router.push('/scraping/jobs')}
                        className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Back to Jobs
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </ProtectedRoute>
          )
        }

        return (
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-100">
              <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                  {/* Job Header */}
                  <div className="md:flex md:items-center md:justify-between mb-8">
                    <div className="flex-1 min-w-0">
                      <h1 className="text-2xl font-semibold text-gray-900">
                        {job.name}
                      </h1>
                      {job.description && (
                        <p className="mt-1 text-sm text-gray-500">
                          {job.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex md:mt-0 md:ml-4">
                      {job.status === 'draft' && (
                        <button
                          onClick={() => handleAction('start')}
                          disabled={isActionInProgress}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          {isActionInProgress ? 'Starting...' : 'Start Job'}
                        </button>
                      )}
                      {job.status === 'running' && (
                        <button
                          onClick={() => handleAction('pause')}
                          disabled={isActionInProgress}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700"
                        >
                          {isActionInProgress ? 'Pausing...' : 'Pause Job'}
                        </button>
                      )}
                      {job.status === 'paused' && (
                        <button
                          onClick={() => handleAction('resume')}
                          disabled={isActionInProgress}
                          className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                          {isActionInProgress ? 'Resuming...' : 'Resume Job'}
                        </button>
                      )}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-md bg-red-50 p-4 mb-6">
                      <div className="text-sm text-red-700">{error}</div>
                    </div>
                  )}

                  {/* Job Stats */}
                  {stats && (
                    <div className="bg-white shadow rounded-lg mb-8">
                      <div className="px-4 py-5 sm:p-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">
                          Job Statistics
                        </h3>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Total
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.total}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Pending
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.pending}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Processing
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.processing}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Completed
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.completed}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">
                              Failed
                            </dt>
                            <dd className="mt-1 text-3xl font-semibold text-gray-900">
                              {stats.failed}
                            </dd>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Profiles List */}
                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Profiles
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                URL
                              </th>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Last Scraped
                              </th>
                              <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Error
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {profiles.map((profile) => (
                              <tr key={profile.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <a
                                    href={profile.profile.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-900"
                                  >
                                    {profile.profile.url}
                                  </a>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                      profile.status
                                    )}`}
                                  >
                                    {profile.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {profile.profile.last_scraped_at
                                    ? format(
                                        new Date(profile.profile.last_scraped_at),
                                        'MMM d, yyyy HH:mm'
                                      )
                                    : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                  {profile.error || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ProtectedRoute>
        )
      }

      function getStatusColor(status: string): string {
        switch (status) {
          case 'pending':
            return 'bg-gray-100 text-gray-800'
          case 'processing':
            return 'bg-yellow-100 text-yellow-800'
          case 'completed':
            return 'bg-green-100 text-green-800'
          case 'failed':
            return 'bg-red-100 text-red-800'
          default:
            return 'bg-gray-100 text-gray-800'
        }
      }
      ```

## 4. Testing Implementation

### 4.1 Unit Tests
[] Create scraping service tests
   [] Create file: src/__tests__/services/scraping/ScrapingService.test.ts
      ```typescript
      import { ScrapingService } from '@/services/scraping/ScrapingService'
      import { browserService } from '@/services/browser/BrowserService'
      import { rateLimitService } from '@/services/scraping/RateLimitService'
      import { WebDriver } from 'selenium-webdriver'

      jest.mock('@/services/browser/BrowserService')
      jest.mock('@/services/scraping/RateLimitService')

      class TestScrapingService extends ScrapingService<{ test: string }> {
        protected async extractData(): Promise<{ test: string }> {
          return { test: 'data' }
        }

        protected validate(data: { test: string }): boolean {
          return data.test === 'data'
        }
      }

      describe('ScrapingService', () => {
        let service: TestScrapingService
        let mockDriver: jest.Mocked<WebDriver>

        beforeEach(() => {
          jest.clearAllMocks()
          service = new TestScrapingService()
          mockDriver = {
            get: jest.fn(),
            wait: jest.fn(),
            quit: jest.fn()
          } as unknown as jest.Mocked<WebDriver>

          browserService.getDriver = jest.fn().mockResolvedValue(mockDriver)
          browserService.releaseDriver = jest.fn()
          rateLimitService.checkRateLimit = jest.fn()
        })

        it('should scrape data successfully', async () => {
          const result = await service.scrape('https://example.com')

          expect(result).toEqual({
            data: { test: 'data' }
          })
          expect(rateLimitService.checkRateLimit).toHaveBeenCalledWith(
            'https://example.com'
          )
          expect(browserService.getDriver).toHaveBeenCalled()
          expect(mockDriver.get).toHaveBeenCalledWith('https://example.com')
          expect(browserService.releaseDriver).toHaveBeenCalledWith(mockDriver)
        })

        it('should handle scraping errors', async () => {
          mockDriver.get.mockRejectedValue(new Error('Failed to load page'))

          const result = await service.scrape('https://example.com')

          expect(result).toEqual({
            data: null,
            error: 'Failed to load page',
            statusCode: 500
          })
          expect(browserService.releaseDriver).toHaveBeenCalledWith(mockDriver)
        })

        it('should handle rate limit errors', async () => {
          rateLimitService.checkRateLimit.mockRejectedValue(
            new Error('Rate limit exceeded')
          )

          const result = await service.scrape('https://example.com')

          expect(result).toEqual({
            data: null,
            error: 'Rate limit exceeded',
            statusCode: 500
          })
        })

        it('should handle invalid data', async () => {
          jest
            .spyOn(service as any, 'extractData')
            .mockResolvedValue({ test: 'invalid' })

          const result = await service.scrape('https://example.com')

          expect(result).toEqual({
            data: null,
            error: 'Invalid data extracted',
            statusCode: 500
          })
        })
      })
      ```

[] Create job service tests
   [] Create file: src/__tests__/services/scraping/JobService.test.ts
      ```typescript
      import { JobService } from '@/services/scraping/JobService'
      import { supabaseClient } from '@/lib/supabase/client'
      import { LinkedInProfileScraper } from '@/services/scraping/LinkedInProfileScraper'

      jest.mock('@/lib/supabase/client')
      jest.mock('@/services/scraping/LinkedInProfileScraper')

      describe('JobService', () => {
        let jobService: JobService
        const mockOrgId = 'test-org-id'
        const mockUserId = 'test-user-id'

        beforeEach(() => {
          jest.clearAllMocks()
          jobService = new JobService(mockOrgId)

          // Mock auth.getUser
          supabaseClient.auth.getUser = jest.fn().mockResolvedValue({
            data: { user: { id: mockUserId } },
            error: null
          })
        })

        describe('createJob', () => {
          it('should create job successfully', async () => {
            const mockJob = {
              id: 'test-job-id',
              name: 'Test Job',
              org_id: mockOrgId,
              status: 'draft'
            }
            supabaseClient.from = jest.fn().mockReturnValue({
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockJob,
                    error: null
                  })
                })
              })
            })

            const result = await jobService.createJob({
              name: 'Test Job',
              source: 'linkedin',
              config: {}
            })

            expect(result).toEqual(mockJob)
          })

          it('should handle creation errors', async () => {
            supabaseClient.from = jest.fn().mockReturnValue({
              insert: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: new Error('Database error')
                  })
                })
              })
            })

            await expect(
              jobService.createJob({
                name: 'Test Job',
                source: 'linkedin',
                config: {}
              })
            ).rejects.toThrow('Failed to create scraping job')
          })
        })

        describe('startJob', () => {
          it('should start job successfully', async () => {
            const mockJob = {
              id: 'test-job-id',
              name: 'Test Job',
              status: 'draft'
            }

            supabaseClient.from = jest.fn().mockReturnValue({
              update: jest.fn().mockResolvedValue({ error: null }),
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockJob,
                    error: null
                  })
                })
              })
            })

            await jobService.startJob('test-job-id')

            expect(supabaseClient.from).toHaveBeenCalledWith('scraping_jobs')
            expect(supabaseClient.from().update).toHaveBeenCalledWith({
              status: 'running',
              started_at: expect.any(String),
              updated_by: mockUserId
            })
          })

          it('should handle start errors', async () => {
            supabaseClient.from = jest.fn().mockReturnValue({
              update: jest.fn().mockResolvedValue({
                error: new Error('Database error')
              })
            })

            await expect(
              jobService.startJob('test-job-id')
            ).rejects.toThrow('Failed to start scraping job')
          })
        })

        describe('processProfiles', () => {
          it('should process profiles successfully', async () => {
            const mockProfiles = [
              {
                id: 'profile-1',
                profile: { url: 'https://example.com/1' }
              },
              {
                id: 'profile-2',
                profile: { url: 'https://example.com/2' }
              }
            ]

            supabaseClient.from = jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: mockProfiles,
                      error: null
                    })
                  })
                })
              }),
              update: jest.fn().mockResolvedValue({ error: null })
            })

            LinkedInProfileScraper.prototype.scrape = jest
              .fn()
              .mockResolvedValue({ data: { test: 'data' } })

            await jobService['processProfiles']('test-job-id')

            expect(LinkedInProfileScraper.prototype.scrape).toHaveBeenCalledTimes(2)
            expect(supabaseClient.from().update).toHaveBeenCalledWith({
              status: 'completed',
              completed_at: expect.any(String),
              updated_by: mockUserId
            })
          })

          it('should handle profile processing errors', async () => {
            const mockProfiles = [
              {
                id: 'profile-1',
                profile: { url: 'https://example.com/1' }
              }
            ]

            supabaseClient.from = jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: mockProfiles,
                      error: null
                    })
                  })
                })
              }),
              update: jest.fn().mockResolvedValue({ error: null })
            })

            LinkedInProfileScraper.prototype.scrape = jest
              .fn()
              .mockRejectedValue(new Error('Scraping error'))

            await jobService['processProfiles']('test-job-id')

            expect(supabaseClient.from().update).toHaveBeenCalledWith({
              status: 'failed',
              error: 'Scraping error',
              updated_by: mockUserId
            })
          })
        })
      })
      ```

### 4.2 Integration Tests
[] Create scraping flow tests
   [] Create file: src/__tests__/integration/scraping.test.ts
      ```typescript
      import { test, expect } from '@playwright/test'
      import { supabaseClient } from '@/lib/supabase/client'
      import { createTestUser, cleanupTestUser } from '../helpers/auth'

      test.describe('Scraping Flow', () => {
        let testUser: { id: string; email: string }

        test.beforeAll(async () => {
          testUser = await createTestUser()
        })

        test.afterAll(async () => {
          await cleanupTestUser(testUser.id)
        })

        test('should create and manage scraping job', async ({ page }) => {
          // 1. Sign in
          await page.goto('/auth/signin')
          await page.fill('input[type="email"]', testUser.email)
          await page.fill('input[type="password"]', 'testpassword')
          await page.click('button[type="submit"]')
          await expect(page).toHaveURL('/dashboard')

          // 2. Navigate to scraping jobs
          await page.click('a[href="/scraping/jobs"]')
          await expect(page).toHaveURL('/scraping/jobs')

          // 3. Create new job
          await page.click('text=Create Job')
          await expect(page).toHaveURL('/scraping/jobs/new')

          await page.fill('input[name="name"]', 'Test Scraping Job')
          await page.fill('textarea[name="description"]', 'Test Description')
          await page.fill(
            'textarea[name="urls"]',
            'https://www.linkedin.com/in/test-profile'
          )

          await page.click('button[type="submit"]')

          // 4. Verify job created
          await expect(page).toHaveURL(/\/scraping\/jobs\/[\w-]+/)
          await expect(page.locator('h1')).toHaveText('Test Scraping Job')

          // 5. Start job
          await page.click('button:text("Start Job")')
          await expect(page.locator('span:text("running")')).toBeVisible()

          // 6. Verify profile status
          await expect(
            page.locator('td:text("https://www.linkedin.com/in/test-profile")')
          ).toBeVisible()

          // 7. Pause job
          await page.click('button:text("Pause Job")')
          await expect(page.locator('span:text("paused")')).toBeVisible()

          // 8. Resume job
          await page.click('button:text("Resume Job")')
          await expect(page.locator('span:text("running")')).toBeVisible()

          // 9. Wait for completion
          await expect(page.locator('span:text("completed")')).toBeVisible({
            timeout: 30000
          })

          // 10. Verify stats
          const statsCard = page.locator('.job-stats')
          await expect(statsCard.locator('text=Total: 1')).toBeVisible()
          await expect(statsCard.locator('text=Completed: 1')).toBeVisible()
        })
      })
      ```

[Continued in next section...] 

## 5. Documentation and Deployment

### 5.1 API Documentation
[] Create API documentation
   [] Create file: docs/api/scraping.md
      ```markdown
      # Scraping API Documentation

      ## Overview
      The Scraping API provides endpoints for managing web scraping jobs and profiles.

      ## Authentication
      All API endpoints require authentication using a valid JWT token. Include the token in the Authorization header:
      ```bash
      Authorization: Bearer <your-jwt-token>
      ```

      ## Endpoints

      ### Create Scraping Job
      ```http
      POST /api/scraping/jobs
      ```

      **Request Body:**
      ```json
      {
        "name": "string",
        "description": "string (optional)",
        "source": "linkedin",
        "config": {
          "waitBetweenRequests": "number (1000-10000)",
          "maxRetries": "number (1-5)"
        },
        "urls": [
          "string (URL)"
        ]
      }
      ```

      **Response:**
      ```json
      {
        "id": "string (UUID)",
        "name": "string",
        "status": "draft",
        "created_at": "string (ISO date)"
      }
      ```

      ### Start Job
      ```http
      POST /api/scraping/jobs/{id}/start
      ```

      **Response:**
      ```json
      {
        "status": "running",
        "started_at": "string (ISO date)"
      }
      ```

      ### Pause Job
      ```http
      POST /api/scraping/jobs/{id}/pause
      ```

      **Response:**
      ```json
      {
        "status": "paused"
      }
      ```

      ### Resume Job
      ```http
      POST /api/scraping/jobs/{id}/resume
      ```

      **Response:**
      ```json
      {
        "status": "running"
      }
      ```

      ### Get Job Stats
      ```http
      GET /api/scraping/jobs/{id}/stats
      ```

      **Response:**
      ```json
      {
        "total": "number",
        "pending": "number",
        "processing": "number",
        "completed": "number",
        "failed": "number"
      }
      ```

      ## Error Handling
      The API uses standard HTTP status codes and returns error messages in the following format:

      ```json
      {
        "error": {
          "code": "string",
          "message": "string",
          "details": "object (optional)"
        }
      }
      ```

      Common error codes:
      - 400: Bad Request
      - 401: Unauthorized
      - 403: Forbidden
      - 404: Not Found
      - 429: Too Many Requests
      - 500: Internal Server Error

      ## Rate Limiting
      API requests are limited to:
      - 100 requests per minute per IP
      - 1000 requests per hour per user
      - 50 concurrent scraping jobs per organization
      ```

### 5.2 Implementation Guide
[] Create implementation guide
   [] Create file: docs/guides/scraping.md
      ```markdown
      # Web Scraping Implementation Guide

      ## Overview
      This guide explains how to implement and use the web scraping functionality in your application.

      ## Prerequisites
      1. Selenium Grid set up with Docker
      2. Required environment variables configured
      3. Database migrations applied

      ## Setup Steps

      ### 1. Infrastructure Setup
      1. Start Selenium Grid:
         ```bash
         docker-compose up -d selenium-hub chrome firefox
         ```

      2. Verify Grid status:
         ```bash
         curl http://localhost:4444/wd/hub/status
         ```

      3. Configure environment variables:
         ```plaintext
         SELENIUM_HUB_URL=http://localhost:4444/wd/hub
         SELENIUM_BROWSER=chrome
         SELENIUM_HEADLESS=true
         ```

      ### 2. Database Setup
      1. Run migrations:
         ```bash
         npm run db:migrate
         ```

      2. Verify tables:
         - scraped_profiles
         - scraping_jobs
         - job_profiles

      3. Check RLS policies:
         ```sql
         SELECT * FROM pg_policies WHERE schemaname = 'public';
         ```

      ### 3. Code Implementation
      1. Create a scraping service:
         ```typescript
         const scraper = new LinkedInProfileScraper()
         const result = await scraper.scrape('https://linkedin.com/in/profile')
         ```

      2. Create and run a job:
         ```typescript
         const jobService = new JobService(organizationId)
         const job = await jobService.createJob({
           name: 'My Scraping Job',
           source: 'linkedin',
           config: {
             waitBetweenRequests: 2000,
             maxRetries: 3
           }
         })

         await jobService.addProfiles(job.id, [
           'https://linkedin.com/in/profile1',
           'https://linkedin.com/in/profile2'
         ])

         await jobService.startJob(job.id)
         ```

      ### 4. Error Handling
      1. Implement error handling for:
         - Rate limits
         - Network issues
         - Invalid profiles
         - Browser errors

      2. Set up logging and monitoring:
         - Use structured logging
         - Monitor job progress
         - Track error rates
         - Set up alerts

      ### 5. Testing
      1. Unit tests:
         - Test service methods
         - Mock browser interactions
         - Verify error handling

      2. Integration tests:
         - Test complete flow
         - Verify data extraction
         - Check job management

      ## Best Practices
      1. Rate Limiting
         - Implement gradual scraping
         - Add delays between requests
         - Monitor API usage

      2. Browser Management
         - Use headless mode
         - Manage resource usage
         - Handle cleanup

      3. Data Quality
         - Validate extracted data
         - Handle missing fields
         - Implement retries

      4. Security
         - Use proxy rotation
         - Handle authentication
         - Secure credentials
      ```

### 5.3 Deployment Checklist
[] Create deployment checklist
   [] Create file: docs/deployment/scraping.md
      ```markdown
      # Web Scraping Deployment Checklist

      ## Pre-deployment
      [] Infrastructure Setup
         [] Configure Selenium Grid
            [] Set up container orchestration
            [] Configure auto-scaling
            [] Set up monitoring
            [] Configure logging

         [] Configure Proxies
            [] Set up proxy pool
            [] Configure rotation
            [] Test proxy reliability
            [] Monitor proxy health

         [] Database Setup
            [] Run migrations
            [] Verify indexes
            [] Check RLS policies
            [] Set up backups

      [] Security
         [] Audit authentication
         [] Review access controls
         [] Check rate limiting
         [] Verify API security

      [] Testing
         [] Run unit tests
         [] Complete integration tests
         [] Perform load testing
         [] Test error scenarios

      ## Deployment
      [] Infrastructure
         [] Deploy Selenium Grid
         [] Configure load balancing
         [] Set up auto-recovery
         [] Monitor resources

      [] Database
         [] Apply migrations
         [] Verify data integrity
         [] Check connections
         [] Monitor performance

      [] API
         [] Deploy API updates
         [] Configure rate limiting
         [] Set up monitoring
         [] Enable logging

      [] Frontend
         [] Deploy UI changes
         [] Verify routing
         [] Check authentication
         [] Test responsiveness

      [] Monitoring
         [] Set up error tracking
         [] Configure alerts
         [] Enable performance monitoring
         [] Set up logging

      ## Post-deployment
      [] Verification
         [] Test scraping flow
         [] Verify job management
         [] Check data extraction
         [] Monitor success rates

      [] Documentation
         [] Update API docs
         [] Update user guides
         [] Document changes
         [] Update troubleshooting guides

      [] Monitoring
         [] Check error rates
         [] Monitor performance
         [] Verify logging
         [] Test alerting

      [] Maintenance
         [] Schedule backups
         [] Plan updates
         [] Set up maintenance windows
         [] Document procedures
      ```

### 5.4 Implementation Checklist Summary
[] Infrastructure Setup
   [] Selenium Grid configured
   [] Proxy management implemented
   [] Rate limiting in place
   [] Error handling configured

[] Backend Implementation
   [] Scraping service implemented
   [] Job management service implemented
   [] Database schema created
   [] API endpoints implemented

[] Frontend Implementation
   [] Job management UI complete
   [] Form validation implemented
   [] Error handling in place
   [] Loading states added

[] Testing
   [] Unit tests written
   [] Integration tests complete
   [] Load testing performed
   [] Security testing done

[] Documentation
   [] API documentation complete
   [] Implementation guide written
   [] Deployment guide created
   [] Testing procedures documented

### 5.5 Next Steps
[] Enhance error handling
[] Add proxy support
[] Implement caching
[] Add retry mechanisms
[] Enhance monitoring
[] Add reporting features
[] Implement rate limit optimization
[] Add support for more sources