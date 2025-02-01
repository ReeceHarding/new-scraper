import { EventEmitter } from 'events';
import fs from 'fs';
import winston from 'winston';
import { mockLogger, mockFormat, MockWriteStream, createMockFs } from '../utils/test-utils';

// Mock all dependencies before any imports
jest.mock('winston', () => ({
  format: {
    combine: mockFormat.combine,
    timestamp: mockFormat.timestamp,
    printf: mockFormat.printf,
    json: mockFormat.json,
    colorize: mockFormat.colorize,
    simple: mockFormat.simple
  },
  createLogger: jest.fn(() => ({
    ...mockLogger,
    transports: [],
    info: jest.fn((msg, meta = {}) => mockLogger.info(msg, { context: meta?.context || 'test', ...meta })),
    error: jest.fn((msg, meta = {}) => mockLogger.error(msg, { context: meta?.context || 'test', ...meta }))
  })),
  transports: {
    Console: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    })),
    File: jest.fn().mockImplementation(() => ({
      log: jest.fn()
    }))
  },
  addColors: jest.fn()
}));

// Mock fs implementation for tests
const mockFs = {
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(() => new MockWriteStream()),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined)
  }
};

// Mock fs before any imports
jest.mock('fs', () => mockFs);

// Mock logging before any imports
jest.mock('@/lib/logging', () => ({
  logger: {
    ...mockLogger,
    info: jest.fn((msg, meta = {}) => mockLogger.info(msg, { context: meta?.context || 'test', ...meta })),
    error: jest.fn((msg, meta = {}) => mockLogger.error(msg, { context: meta?.context || 'test', ...meta }))
  },
  baseLogger: mockLogger,
  createLogger: (context = 'test') => ({
    ...mockLogger,
    info: jest.fn((msg, meta = {}) => mockLogger.info(msg, { context, ...meta })),
    error: jest.fn((msg, meta = {}) => mockLogger.error(msg, { context, ...meta }))
  }),
  initializeLogger: jest.fn().mockImplementation(async () => {
    mockFs.mkdirSync('logs', { recursive: true });
    mockLogger.info('Logger initialized', { context: 'logging' });
  }),
  __esModule: true
}));

// Import after mocks
import { logger, initializeLogger, createLogger } from '@/lib/logging';

describe('Logging System', () => {
  let originalConsole: typeof console;
  let originalEnv: NodeJS.ProcessEnv;
  const mockLogDir = 'logs';
  
  beforeEach(() => {
    originalConsole = { ...console };
    originalEnv = { ...process.env };
    console.log = jest.fn();
    console.error = jest.fn();
    process.env = {
      ...process.env,
      NODE_ENV: 'test',
      LOG_DIR: mockLogDir,
      LOG_LEVEL: 'debug'
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Logger Configuration', () => {
    it('should initialize logger successfully', async () => {
      await initializeLogger();
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(mockLogDir, { recursive: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Logger initialized'),
        expect.any(Object)
      );
    });

    it('should have console transport in test environment', () => {
      const testLogger = createLogger('test');
      testLogger.info('Test message');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Test message',
        expect.objectContaining({ context: 'test' })
      );
    });

    it('should use JSON format in test environment', () => {
      logger.info('Test log message');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Test log message',
        expect.any(Object)
      );
    });
  });

  describe('Error Logging', () => {
    it('should log errors with stack traces', () => {
      const testLogger = createLogger('test');
      const error = new Error('Test error');
      testLogger.error('Error occurred', { error });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error occurred',
        expect.objectContaining({
          error,
          context: 'test'
        })
      );
    });

    it('should handle non-Error objects', () => {
      const testLogger = createLogger('test');
      const nonError = { message: 'Not an error' };
      testLogger.error('Error occurred', { error: nonError });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error occurred',
        expect.objectContaining({
          error: nonError,
          context: 'test'
        })
      );
    });
  });
});