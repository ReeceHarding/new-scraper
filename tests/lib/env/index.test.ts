import { validateEnv, getEnvConfig, getSupabaseConfig, getRedisConfig, getOpenAIConfig, getPineconeConfig, getGmailConfig, getBrowserConfig, getLoggingConfig } from '../../../src/lib/env/env'
import { ConfigError } from '../../../src/lib/errors'

describe('Environment Validation Module', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      SUPABASE_DB_PASSWORD: 'test-password',

      // Redis
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',

      // OpenAI
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_MODEL_VERSION: 'gpt-4',
      OPENAI_MAX_TOKENS: '4096',

      // Pinecone
      PINECONE_API_KEY: 'test-pinecone-key',
      PINECONE_ENVIRONMENT: 'test-env',
      PINECONE_INDEX: 'test-index',
      PINECONE_HOST: 'https://test.pinecone.io',

      // Gmail
      GMAIL_CLIENT_ID: 'test-client-id',
      GMAIL_CLIENT_SECRET: 'test-client-secret',
      GMAIL_REDIRECT_URI: 'https://test.example.com/callback',

      // Browser Service
      BROWSER_POOL_SIZE: '5',
      BROWSER_PAGE_TIMEOUT: '30000',
      BROWSER_REQUEST_TIMEOUT: '10000',

      // Logging
      LOG_FILE_PATH: './logs/app.log',
      LOG_ERROR_PATH: './logs/error.log',
      LOG_LEVEL: 'info'
    } as NodeJS.ProcessEnv
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('validateEnv', () => {
    it('should validate all environment variables successfully', () => {
      expect(() => validateEnv()).not.toThrow()
      const config = validateEnv()
      expect(config).toBeDefined()
    })

    it('should throw ConfigError for missing required variables', () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      // @ts-ignore - Intentionally setting to undefined to test validation
      process.env.NEXT_PUBLIC_SUPABASE_URL = undefined
      expect(() => validateEnv()).toThrow(ConfigError)
      process.env.NEXT_PUBLIC_SUPABASE_URL = url
    })

    it('should throw ConfigError for invalid URL format', () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url'
      expect(() => validateEnv()).toThrow(ConfigError)
      process.env.NEXT_PUBLIC_SUPABASE_URL = url
    })

    it('should allow optional LOG_LEVEL', () => {
      const logLevel = process.env.LOG_LEVEL
      // @ts-ignore - Intentionally setting to undefined to test validation
      process.env.LOG_LEVEL = undefined
      expect(() => validateEnv()).not.toThrow()
      process.env.LOG_LEVEL = logLevel
    })
  })

  describe('getEnvConfig', () => {
    it('should return validated environment config', () => {
      const config = getEnvConfig()
      expect(config).toBeDefined()
      expect(config.NEXT_PUBLIC_SUPABASE_URL).toBeDefined()
      expect(config.REDIS_HOST).toBeDefined()
      expect(config.OPENAI_API_KEY).toBeDefined()
    })
  })

  describe('Service-specific configs', () => {
    describe('getSupabaseConfig', () => {
      it('should return valid Supabase configuration', () => {
        const config = getSupabaseConfig()
        expect(config.url).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/)
        expect(config.anonKey).toMatch(/^ey/)
        expect(config.serviceRoleKey).toMatch(/^ey/)
        expect(config.dbPassword).toBeDefined()
      })
    })

    describe('getRedisConfig', () => {
      it('should return valid Redis configuration', () => {
        const config = getRedisConfig()
        expect(config.host).toBe('localhost')
        expect(config.port).toBe(6379)
      })
    })

    describe('getOpenAIConfig', () => {
      it('should return valid OpenAI configuration', () => {
        const config = getOpenAIConfig()
        expect(config.apiKey).toBeDefined()
        expect(config.modelVersion).toBeDefined()
        expect(config.maxTokens).toBeGreaterThan(0)
      })
    })

    describe('getPineconeConfig', () => {
      it('should return valid Pinecone configuration', () => {
        const config = getPineconeConfig()
        expect(config.apiKey).toBeDefined()
        expect(config.environment).toBeDefined()
        expect(config.index).toBeDefined()
        expect(config.host).toMatch(/^https:\/\//)
      })
    })

    describe('getGmailConfig', () => {
      it('should return valid Gmail configuration', () => {
        const config = getGmailConfig()
        expect(config.clientId).toBeDefined()
        expect(config.clientSecret).toBeDefined()
        expect(config.redirectUri).toMatch(/^https?:\/\//)
      })
    })

    describe('getBrowserConfig', () => {
      it('should return valid browser service configuration', () => {
        const config = getBrowserConfig()
        expect(config.poolSize).toBeGreaterThan(0)
        expect(config.pageTimeout).toBeGreaterThan(0)
        expect(config.requestTimeout).toBeGreaterThan(0)
      })
    })

    describe('getLoggingConfig', () => {
      it('should return valid logging configuration', () => {
        const config = getLoggingConfig()
        expect(config.filePath).toBeDefined()
        expect(config.errorPath).toBeDefined()
      })

      it('should handle optional LOG_LEVEL', () => {
        const logLevel = process.env.LOG_LEVEL
        // @ts-ignore - Intentionally setting to undefined to test validation
        process.env.LOG_LEVEL = undefined
        const config = getLoggingConfig()
        expect(config.level).toBeUndefined()
        process.env.LOG_LEVEL = logLevel
      })
    })
  })
}) 