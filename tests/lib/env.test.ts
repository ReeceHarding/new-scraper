import { envSchema } from '../../src/lib/env';

describe('Environment Variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { 
      ...originalEnv,
      // Add required base environment variables
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-role-key',
      SUPABASE_DB_PASSWORD: 'test-password',
      BRAVE_API_KEY: 'test-brave-key',
      BRAVE_SEARCH_RATE_LIMIT: '100',
      OPENAI_API_KEY: 'test-openai-key',
      OPENAI_MODEL_VERSION: 'gpt-4',
      OPENAI_MAX_TOKENS: '2000',
      PINECONE_API_KEY: 'test-pinecone-key',
      PINECONE_ENV: 'test',
      PINECONE_INDEX: 'test-index',
      PINECONE_HOST: 'https://test.pinecone.io',
      NEXT_PUBLIC_GMAIL_CLIENT_ID: 'test-client-id',
      GMAIL_CLIENT_SECRET: 'test-secret',
      NEXT_PUBLIC_GMAIL_REDIRECT_URI: 'http://localhost:3000/callback',
      LOG_FILE_PATH: 'logs/test.log',
      ERROR_LOG_PATH: 'logs/error.log'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Redis Configuration', () => {
    it('should fail with invalid Redis port', () => {
      process.env.REDIS_PORT = 'invalid-port';
      process.env.REDIS_HOST = 'localhost';
      
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid port number');
      }
    });

    it('should pass with valid Redis port', () => {
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_HOST = 'localhost';
      
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.REDIS_PORT).toBe(6379);
      }
    });
  });

  describe('Browser Service Configuration', () => {
    it('should fail with invalid browser pool size', () => {
      process.env.BROWSER_POOL_SIZE = 'invalid-size';
      process.env.BROWSER_PAGE_TIMEOUT = '30000';
      process.env.BROWSER_REQUEST_TIMEOUT = '10000';
      
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid pool size');
      }
    });

    it('should pass with valid browser pool size', () => {
      process.env.BROWSER_POOL_SIZE = '5';
      process.env.BROWSER_PAGE_TIMEOUT = '30000';
      process.env.BROWSER_REQUEST_TIMEOUT = '10000';
      
      const result = envSchema.safeParse(process.env);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.BROWSER_POOL_SIZE).toBe(5);
      }
    });
  });
});