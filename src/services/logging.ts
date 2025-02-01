import winston from 'winston';
import path from 'path';

const logDir = process.env.LOG_FILE_PATH || 'logs';
const errorLogPath = process.env.ERROR_LOG_PATH || 'logs/error.log';

// Configure Winston
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'lead-generation-platform' },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({ 
      filename: errorLogPath,
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    // Write all logs with importance level of 'info' or less to combined.log
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

// If we're not in production, log to the console with colors
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

// Create a wrapper around Winston logger
const winstonLogger: Logger = {
  info: (message: string, meta?: any) => {
    logger.info(message, meta);
  },
  error: (message: string, meta?: any) => {
    logger.error(message, meta);
  },
  warn: (message: string, meta?: any) => {
    logger.warn(message, meta);
  },
  debug: (message: string, meta?: any) => {
    logger.debug(message, meta);
  },
};

export const createContextLogger = (context: string): Logger => {
  return {
    info: (message: string, meta?: any) => winstonLogger.info(message, { ...meta, context }),
    error: (message: string, meta?: any) => winstonLogger.error(message, { ...meta, context }),
    warn: (message: string, meta?: any) => winstonLogger.warn(message, { ...meta, context }),
    debug: (message: string, meta?: any) => winstonLogger.debug(message, { ...meta, context }),
  };
};

// Export pre-configured loggers for different contexts
export const dbLogger = createContextLogger('database');
export const migrationLogger = createContextLogger('migrations');
export const scrapingLogger = createContextLogger('scraping');
export const emailLogger = createContextLogger('email');
export const authLogger = createContextLogger('auth');

// Export the base logger for general use
export { winstonLogger as logger }; 