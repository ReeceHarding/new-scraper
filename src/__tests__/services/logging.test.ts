import winston from 'winston';
import {
  logger,
  createContextLogger,
  dbLogger,
  migrationLogger,
  scrapingLogger,
  emailLogger,
  authLogger
} from '@/services/logging';

// Mock winston
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
    errors: jest.fn()
  };
  
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  };

  return {
    format: mockFormat,
    createLogger: jest.fn(() => mockLogger),
    transports: {
      File: jest.fn(),
      Console: jest.fn()
    }
  };
});

describe('Logging System', () => {
  let mockWinstonLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWinstonLogger = winston.createLogger();
  });

  describe('Base Logger', () => {
    it('should log info messages', () => {
      const message = 'Test info message';
      const meta = { key: 'value' };
      
      logger.info(message, meta);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(message, meta);
    });

    it('should log error messages', () => {
      const message = 'Test error message';
      const meta = { error: new Error('Test error') };
      
      logger.error(message, meta);
      
      expect(mockWinstonLogger.error).toHaveBeenCalledWith(message, meta);
    });

    it('should log warning messages', () => {
      const message = 'Test warning message';
      const meta = { warning: 'Test warning' };
      
      logger.warn(message, meta);
      
      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(message, meta);
    });

    it('should log debug messages', () => {
      const message = 'Test debug message';
      const meta = { debug: 'Test debug' };
      
      logger.debug(message, meta);
      
      expect(mockWinstonLogger.debug).toHaveBeenCalledWith(message, meta);
    });
  });

  describe('Context Logger', () => {
    it('should create a context logger', () => {
      const contextLogger = createContextLogger('test-context');
      expect(contextLogger).toHaveProperty('info');
      expect(contextLogger).toHaveProperty('error');
      expect(contextLogger).toHaveProperty('warn');
      expect(contextLogger).toHaveProperty('debug');
    });

    it('should add context to log messages', () => {
      const contextLogger = createContextLogger('test-context');
      const message = 'Test message';
      const meta = { key: 'value' };
      
      contextLogger.info(message, meta);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          ...meta,
          context: 'test-context'
        })
      );
    });

    it('should preserve existing meta data when adding context', () => {
      const contextLogger = createContextLogger('test-context');
      const message = 'Test message';
      const meta = { existingKey: 'existingValue' };
      
      contextLogger.info(message, meta);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          existingKey: 'existingValue',
          context: 'test-context'
        })
      );
    });
  });

  describe('Pre-configured Loggers', () => {
    it('should have database logger with correct context', () => {
      const message = 'Database operation';
      dbLogger.info(message);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          context: 'database'
        })
      );
    });

    it('should have migration logger with correct context', () => {
      const message = 'Migration operation';
      migrationLogger.info(message);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          context: 'migrations'
        })
      );
    });

    it('should have scraping logger with correct context', () => {
      const message = 'Scraping operation';
      scrapingLogger.info(message);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          context: 'scraping'
        })
      );
    });

    it('should have email logger with correct context', () => {
      const message = 'Email operation';
      emailLogger.info(message);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          context: 'email'
        })
      );
    });

    it('should have auth logger with correct context', () => {
      const message = 'Auth operation';
      authLogger.info(message);
      
      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        message,
        expect.objectContaining({
          context: 'auth'
        })
      );
    });
  });
}); 