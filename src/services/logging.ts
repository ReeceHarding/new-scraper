import pino from 'pino'

// Configure log level based on environment
const level = process.env.LOG_LEVEL || 'info'

// Create logger instance
export const logger = pino({
  level,
  timestamp: true,
  formatters: {
    level: (label) => {
      return { level: label }
    }
  },
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard'
    }
  }
})

// Add custom log methods for specific contexts
export const createContextLogger = (context: string) => {
  return {
    info: (msg: string, obj = {}) => logger.info({ context, ...obj }, msg),
    error: (msg: string, obj = {}) => logger.error({ context, ...obj }, msg),
    warn: (msg: string, obj = {}) => logger.warn({ context, ...obj }, msg),
    debug: (msg: string, obj = {}) => logger.debug({ context, ...obj }, msg)
  }
}

// Create specific loggers for different parts of the application
export const dbLogger = createContextLogger('database')
export const migrationLogger = createContextLogger('migrations')
export const scrapingLogger = createContextLogger('scraping')
export const emailLogger = createContextLogger('email')
export const authLogger = createContextLogger('auth') 