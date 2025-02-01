import winston from 'winston'
import path from 'path'
import { isCustomError } from '../errors'
import fs from 'fs'

// Define custom log levels and colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
}

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
}

// Log directory configuration
const LOG_DIR = process.env.LOG_DIR || 'logs'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'
const LOG_FILE_PATH = process.env.LOG_FILE_PATH || path.join(LOG_DIR, 'combined.log')
const ERROR_LOG_PATH = process.env.ERROR_LOG_PATH || path.join(LOG_DIR, 'error.log')
const SEARCH_LOG_PATH = path.join(LOG_DIR, 'search.log')
const ANALYSIS_LOG_PATH = path.join(LOG_DIR, 'analysis.log')
const BROWSER_LOG_PATH = path.join(LOG_DIR, 'browser.log')

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

// Create custom format
const customFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
    return `${timestamp} ${level}: ${message} ${metaStr}`
  })
)

// Create the base logger
export const baseLogger = winston.createLogger({
  level: LOG_LEVEL,
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
    new winston.transports.File({
      filename: ERROR_LOG_PATH,
      level: 'error'
    }),
    new winston.transports.File({
      filename: LOG_FILE_PATH
    })
  ]
})

// Configure colors for console output
winston.addColors(colors)

// Export logging functions
export const logError = (message: string, meta?: any): void => { baseLogger.error(message, meta) }
export const logWarn = (message: string, meta?: any): void => { baseLogger.warn(message, meta) }
export const logInfo = (message: string, meta?: any): void => { baseLogger.info(message, meta) }
export const logHttp = (message: string, meta?: any): void => { baseLogger.http(message, meta) }
export const logDebug = (message: string, meta?: any): void => { baseLogger.debug(message, meta) }

// Export the logger instance
export const logger = baseLogger

// Create logger instance with context
export const createLogger = (context: string) => {
  return {
    ...baseLogger,
    info: (message: string, meta?: any) => baseLogger.info(message, { ...meta, context }),
    error: (message: string, meta?: any) => baseLogger.error(message, { ...meta, context }),
    warn: (message: string, meta?: any) => baseLogger.warn(message, { ...meta, context }),
    debug: (message: string, meta?: any) => baseLogger.debug(message, { ...meta, context }),
    http: (message: string, meta?: any) => baseLogger.http(message, { ...meta, context })
  }
}

// Create specialized loggers for different services
export const searchLogger = createLogger('search-service')
export const analysisLogger = createLogger('analysis-service')
export const browserLogger = createLogger('browser-service')
export const dbLogger = createLogger('database')
export const migrationLogger = createLogger('migrations')
export const scrapingLogger = createLogger('scraping')
export const emailLogger = createLogger('email')
export const authLogger = createLogger('auth')

// Helper function to log HTTP requests
export function logHttpRequest(
  method: string,
  url: string,
  status: number,
  duration: number
): void {
  logger.http(`${method} ${url} ${status} ${duration}ms`)
}

// Helper function to log performance metrics
export function logPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  logger.info(`Performance: ${operation} took ${duration}ms`, metadata)
}

// Helper function to log business events
export function logBusinessEvent(
  event: string,
  data: Record<string, unknown>
): void {
  logger.info(`Business Event: ${event}`, data)
}

// Helper functions for common logging patterns
export const logWarning = (message: string, context: string, metadata: any = {}) => {
  logger.warn(`[${context}] ${message}`, metadata)
}

// Log categories
export const logCategories = {
  SYSTEM: 'system',
  SECURITY: 'security',
  BUSINESS: 'business',
  PERFORMANCE: 'performance',
  API: 'api'
} as const

type LogCategory = typeof logCategories[keyof typeof logCategories]

export const logWithCategory = (
  level: string,
  category: LogCategory,
  message: string,
  meta?: Record<string, any>
): void => {
  logger.log(level, `[${category}] ${message}`, { category, ...meta })
}

export const logInfoWithCategory = (category: LogCategory, message: string, meta?: Record<string, any>) =>
  logWithCategory('info', category, message, meta)

export const logErrorWithCategory = (category: LogCategory, message: string, error?: Error, meta?: Record<string, any>) =>
  logWithCategory('error', category, message, {
    ...(error && {
      error: {
        message: error.message,
        stack: error.stack
      }
    }),
    ...meta
  })

export const logWarnWithCategory = (category: LogCategory, message: string, meta?: Record<string, any>) =>
  logWithCategory('warn', category, message, meta)

export const logDebugWithCategory = (category: LogCategory, message: string, meta?: Record<string, any>) =>
  logWithCategory('debug', category, message, meta)

export const logSecurityEvent = (
  event: string,
  userId: string,
  meta?: Record<string, any>
) => {
  logInfoWithCategory(logCategories.SECURITY, event, {
    userId,
    ...meta
  })
}

export const logAPIRequest = (
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  meta?: Record<string, any>
) => {
  logInfoWithCategory(logCategories.API, `${method} ${path}`, {
    statusCode,
    durationMs,
    ...meta
  })
}

// Helper function to log errors with context
export function logErrorWithContext(error: unknown, context?: Record<string, unknown>): void {
  if (isCustomError(error)) {
    logger.error(`[${error.name}] ${error.message}`, {
      ...context,
      stack: error.stack,
    })
  } else if (error instanceof Error) {
    logger.error(`[UnhandledError] ${error.message}`, {
      ...context,
      stack: error.stack,
    })
  } else {
    logger.error('[UnknownError]', {
      ...context,
      error
    })
  }
}

// Initialize logger function
export const initializeLogger = async (): Promise<void> => {
  // Ensure log directory exists
  if (!fs.existsSync(LOG_DIR)) {
    await fs.promises.mkdir(LOG_DIR, { recursive: true })
  }

  // Configure colors for console output
  winston.addColors(colors)

  // Remove existing transports
  baseLogger.transports.forEach(t => baseLogger.remove(t))
  
  // Add new transports
  baseLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      customFormat
    )
  }))
  
  baseLogger.add(new winston.transports.File({
    filename: ERROR_LOG_PATH,
    level: 'error'
  }))
  
  baseLogger.add(new winston.transports.File({
    filename: LOG_FILE_PATH
  }))

  baseLogger.info('Logger initialized', { context: 'system' })

  // Initialize specialized loggers
  await Promise.all([
    searchLogger,
    analysisLogger,
    browserLogger,
    dbLogger,
    migrationLogger,
    scrapingLogger,
    emailLogger,
    authLogger
  ])
}

// Export default logger
export default baseLogger 