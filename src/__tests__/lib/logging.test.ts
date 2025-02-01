import winston from 'winston';
import {
  logger,
  searchLogger,
  analysisLogger,
  browserLogger,
  logError,
  logWarning,
  logInfo,
  logDebug,
  logPerformance,
  requestLogger
} from '@/lib/logging';

// Mock winston
jest.mock('winston', () => {
  const mockFormat = {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    splat: jest.fn(),
    json: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn()
  };
  
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis()
  };

  return {
    format: mockFormat,
    createLogger: jest.fn().mockReturnValue(mockLogger),
    transports: {
      File: jest.fn(),
      Console: jest.fn()
    }
  };
});

describe('Logging System', () => {
  let mockWinston: any;
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
    mockWinston = winston;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Logger Configuration', () => {
    it('should create a logger with correct configuration', () => {
      expect(mockWinston.createLogger).toHaveBeenCalled();
      const createLoggerArgs = mockWinston.createLogger.mock.calls[0][0];
      
      expect(createLoggerArgs.level).toBe('info');
      expect(createLoggerArgs.defaultMeta).toEqual({
        service: 'lead-generation-platform'
      });
    });

    it('should create specialized loggers for different services', () => {
      expect(searchLogger).toBeDefined();
      expect(analysisLogger).toBeDefined();
      expect(browserLogger).toBeDefined();
    });
  });

  describe('Logging Functions', () => {
    const context = 'test-context';
    const message = 'test message';
    const metadata = { key: 'value' };

    describe('logError', () => {
      it('should log errors with stack trace', () => {
        const error = new Error('test error');
        logError(error, context, metadata);

        expect(logger.error).toHaveBeenCalledWith(
          `[${context}] ${error.message}`,
          expect.objectContaining({
            errorName: error.name,
            stack: error.stack,
            key: metadata.key
          })
        );
      });
    });

    describe('logWarning', () => {
      it('should log warnings with context', () => {
        logWarning(message, context, metadata);

        expect(logger.warn).toHaveBeenCalledWith(
          `[${context}] ${message}`,
          metadata
        );
      });
    });

    describe('logInfo', () => {
      it('should log info messages with context', () => {
        logInfo(message, context, metadata);

        expect(logger.info).toHaveBeenCalledWith(
          `[${context}] ${message}`,
          metadata
        );
      });
    });

    describe('logDebug', () => {
      it('should log debug messages with context', () => {
        logDebug(message, context, metadata);

        expect(logger.debug).toHaveBeenCalledWith(
          `[${context}] ${message}`,
          metadata
        );
      });
    });

    describe('logPerformance', () => {
      it('should log performance metrics', () => {
        const operation = 'test-operation';
        const duration = 100;

        logPerformance(operation, duration, metadata);

        expect(logger.info).toHaveBeenCalledWith(
          `Performance: ${operation} took ${duration}ms`,
          expect.objectContaining({
            operation,
            duration,
            key: metadata.key
          })
        );
      });
    });
  });

  describe('Request Logger Middleware', () => {
    it('should log HTTP requests with timing', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        get: jest.fn().mockReturnValue('test-user-agent')
      };
      
      const res = {
        statusCode: 200,
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        })
      };
      
      const next = jest.fn();

      // Mock Date.now
      const originalDateNow = Date.now;
      const mockTime = 1000;
      Date.now = jest.fn()
        .mockReturnValueOnce(mockTime)
        .mockReturnValueOnce(mockTime + 100);

      requestLogger(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'HTTP GET /api/test',
        expect.objectContaining({
          method: 'GET',
          url: '/api/test',
          status: 200,
          duration: 100,
          userAgent: 'test-user-agent'
        })
      );

      // Restore Date.now
      Date.now = originalDateNow;
    });
  });

  describe('Environment-specific behavior', () => {
    it('should add console transport in development', () => {
      // Create a new environment object with development settings
      const devEnv = {
        ...process.env,
        NODE_ENV: 'development' as const
      };
      
      // Use jest.isolateModules with the new environment
      jest.isolateModules(() => {
        process.env = devEnv;
        require('@/lib/logging');
        expect(mockWinston.transports.Console).toHaveBeenCalled();
      });
    });

    it('should not add console transport in production', () => {
      // Create a new environment object with production settings
      const prodEnv = {
        ...process.env,
        NODE_ENV: 'production' as const
      };
      
      jest.isolateModules(() => {
        process.env = prodEnv;
        require('@/lib/logging');
        expect(mockWinston.transports.Console).not.toHaveBeenCalled();
      });
    });
  });
}); 