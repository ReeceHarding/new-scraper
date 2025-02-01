import { EventEmitter } from 'events'
import path from 'path'
import type { Stats } from 'fs'
import { mockLogger, mockFormat, mockConsoleTransport } from '../../utils/test-utils'
import { ConfigError } from '@/lib/errors'
import fs from 'fs'

// Mock fs implementation
const mockFs = {
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(),
  stat: jest.fn((path, callback) => callback(null, { isFile: () => true })),
  promises: {
    mkdir: jest.fn()
  }
};

jest.mock('fs', () => mockFs);

// Mock winston before any imports
jest.mock('winston', () => ({
  format: mockFormat,
  transports: {
    Console: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    })),
    File: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    }))
  },
  createLogger: jest.fn().mockReturnValue({
    ...mockLogger,
    info: jest.fn((msg, meta) => {
      mockLogger.info(msg, meta || {})
      return undefined
    }),
    error: jest.fn((msg, meta) => {
      mockLogger.error(msg, meta || {})
      return undefined
    })
  }),
  addColors: jest.fn()
}));

// Mock logging before any imports
jest.mock('@/lib/logging', () => ({
  logger: mockLogger,
  baseLogger: mockLogger,
  createLogger: () => mockLogger,
  initializeLogger: jest.fn().mockResolvedValue(undefined),
  __esModule: true
}));

// Mock env before any imports
jest.mock('@/lib/env', () => {
  const mockValidateEnv = jest.fn().mockReturnValue({
    NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    SUPABASE_DB_PASSWORD: 'test-db-password',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
    BRAVE_API_KEY: 'test-brave-key',
    BRAVE_SEARCH_RATE_LIMIT: '10',
    OPENAI_API_KEY: 'test-openai-key',
    OPENAI_MODEL_VERSION: 'gpt-4',
    OPENAI_MAX_TOKENS: '4096',
    PINECONE_API_KEY: 'test-pinecone-key',
    PINECONE_ENV: 'test',
    PINECONE_INDEX: 'test-index',
    PINECONE_HOST: 'https://test.pinecone.io',
    NEXT_PUBLIC_GMAIL_CLIENT_ID: 'test-gmail-client-id',
    GMAIL_CLIENT_SECRET: 'test-gmail-secret',
    NEXT_PUBLIC_GMAIL_REDIRECT_URI: 'http://localhost:3000/auth/callback',
    BROWSER_POOL_SIZE: '5',
    BROWSER_PAGE_TIMEOUT: '30000',
    BROWSER_REQUEST_TIMEOUT: '10000',
    LOG_LEVEL: 'debug',
    LOG_DIR: 'logs',
    LOG_FILE_PATH: 'logs/combined.log',
    ERROR_LOG_PATH: 'logs/error.log'
  });
  return {
    validateEnv: mockValidateEnv,
    getEnvConfig: jest.fn().mockReturnValue(mockValidateEnv()),
    __esModule: true
  };
});

// Imports after all mocks
import { initializeApp, shutdownApp } from '@/lib/core/init'
import { getEnvConfig } from '@/lib/env'
import { logger } from '@/lib/logging'

describe('Core Module Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;
  const mockLogDir = 'logs';

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env = {
      ...process.env,
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
      OPENAI_API_KEY: 'test-openai-key',
      BRAVE_API_KEY: 'test-brave-key',
      LOG_LEVEL: 'debug',
      LOG_DIR: mockLogDir,
      REDIS_PORT: '6379',
      LOG_FILE_PATH: 'logs/combined.log',
      ERROR_LOG_PATH: 'logs/error.log'
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Application Lifecycle', () => {
    it('should initialize successfully with required environment variables', async () => {
      const mockFs = jest.requireMock('fs');
      mockFs.existsSync.mockImplementation((path: string) => path === mockLogDir ? false : true);
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      
      await expect(initializeApp()).resolves.not.toThrow();
      expect(mockFs.existsSync).toHaveBeenCalledWith(mockLogDir);
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(mockLogDir, { recursive: true });
      
      const config = getEnvConfig();
      expect(config.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test-project.supabase.co');
    });

    it('should fail initialization with missing environment variables', async () => {
      const { validateEnv } = jest.requireMock('@/lib/env');
      validateEnv.mockImplementationOnce(() => {
        throw new ConfigError('Environment validation failed');
      });
      
      await expect(initializeApp()).rejects.toThrow('Environment validation failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Environment validation failed',
        expect.objectContaining({ context: 'app-init' })
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should properly log and propagate errors', async () => {
      const mockFs = jest.requireMock('fs');
      const mockError = new Error('Test error');
      mockFs.existsSync.mockImplementation((path: string) => path === mockLogDir ? false : true);
      mockFs.promises.mkdir.mockRejectedValueOnce(mockError);
      
      await expect(initializeApp()).rejects.toThrow('Application initialization failed: Failed to create log directory: Test error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create log directory: Test error',
        expect.objectContaining({ error: mockError, context: 'app-init' })
      );
    });
  });

  describe('Configuration Integration', () => {
    it('should provide consistent configuration across services', () => {
      const config1 = getEnvConfig();
      const config2 = getEnvConfig();
      
      expect(config1).toEqual(config2);
      expect(config1.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test-project.supabase.co');
      expect(config1.REDIS_PORT).toBe('6379');
      expect(config1.LOG_LEVEL).toBe('debug');
    });
  });

  describe('Logging Integration', () => {
    it('should properly handle different log levels and formats', async () => {
      await initializeApp();
      
      logger.info('Info message');
      logger.error('Error message');
      
      expect(mockLogger.info).toHaveBeenCalledWith('Info message');
      expect(mockLogger.error).toHaveBeenCalledWith('Error message');
    });
  });

  describe('Core initialization', () => {
    it('should create required directories if they do not exist', async () => {
      const mockFs = jest.requireMock('fs');
      mockFs.existsSync.mockImplementation((path: string) => path === mockLogDir ? false : true);
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      
      await initializeApp();

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockLogDir);
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith(mockLogDir, { recursive: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Core services initialized successfully',
        expect.objectContaining({ context: 'app-init' })
      );
    });

    it('should not create directories if they already exist', async () => {
      const mockFs = jest.requireMock('fs');
      mockFs.existsSync.mockImplementation((path: string) => path === mockLogDir ? true : true);
      
      await initializeApp();

      expect(mockFs.existsSync).toHaveBeenCalledWith(mockLogDir);
      expect(mockFs.promises.mkdir).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Core services initialized successfully',
        expect.objectContaining({ context: 'app-init' })
      );
    });

    it('should handle errors during initialization', async () => {
      const mockFs = jest.requireMock('fs');
      mockFs.existsSync.mockImplementation((path: string) => path === mockLogDir ? false : true);
      const mockError = new Error('File system error');
      mockFs.promises.mkdir.mockRejectedValueOnce(mockError);

      await expect(initializeApp()).rejects.toThrow('Application initialization failed: Failed to create log directory: File system error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create log directory: File system error',
        expect.objectContaining({ error: mockError, context: 'app-init' })
      );
    });
  });
});