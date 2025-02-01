import { logger } from '../src/lib/logging'
import { SearchError, AnalysisError, BrowserError } from '../src/lib/errors'
import winston from 'winston'

describe('Infrastructure Setup', () => {
  describe('Error Handling', () => {
    it('should create custom errors with correct names', () => {
      const searchError = new SearchError('Search failed')
      const analysisError = new AnalysisError('Analysis failed')
      const browserError = new BrowserError('Browser failed')

      expect(searchError.name).toBe('SearchError')
      expect(analysisError.name).toBe('AnalysisError')
      expect(browserError.name).toBe('BrowserError')

      expect(searchError.message).toBe('Search failed')
      expect(analysisError.message).toBe('Analysis failed')
      expect(browserError.message).toBe('Browser failed')
    })
  })

  describe('Logging', () => {
    it('should initialize logger with correct configuration', () => {
      expect(logger).toBeDefined()
      expect(logger.level).toBe(process.env.LOG_LEVEL || 'info')
      
      // Verify transports
      const transports = logger.transports
      expect(transports.length).toBeGreaterThan(0)
      
      // Verify at least one file transport exists
      const fileTransports = transports.filter(t => t instanceof winston.transports.File)
      expect(fileTransports.length).toBeGreaterThan(0)
    })
  })

  describe('Database Connection', () => {
    it('should connect to Supabase and verify connection', async () => {
      expect(global.supabaseClient).toBeDefined()

      const { data, error } = await global.supabaseClient
        .from('organizations')
        .select('count')
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })
  })

  describe('Environment Variables', () => {
    const requiredEnvVars = {
      // Supabase
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

      // OpenAI
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,

      // Redis
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT,

      // Brave Search
      BRAVE_API_KEY: process.env.BRAVE_API_KEY,
    }

    it('should have all required environment variables', () => {
      Object.entries(requiredEnvVars).forEach(([key, value]) => {
        expect(value).toBeDefined()
        expect(value).not.toBe('')
        expect(typeof value).toBe('string')
      })
    })

    it('should have valid Supabase configuration', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/)
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toMatch(/^ey/)
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toMatch(/^ey/)
    })

    it('should have valid Redis configuration', () => {
      expect(process.env.REDIS_HOST).toBe('localhost')
      expect(Number(process.env.REDIS_PORT)).toBe(6379)
    })
  })
}) 