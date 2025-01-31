import winston from 'winston'

const logLevels = {
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
  debug: 'white'
}

winston.addColors(colors)

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
)

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  new winston.transports.File({ filename: 'logs/all.log' }),
]

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: logLevels,
  format,
  transports,
})

// Create a stream object for Morgan HTTP request logging
export const stream = {
  write: (message: string) => {
    logger.http(message.trim())
  },
}

// Add request context to logs
export const addRequestContext = (req: any) => {
  return {
    method: req.method,
    url: req.url,
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
  }
}

// Log errors with stack traces
export const logError = (error: Error, context: any = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    ...context,
  })
}

// Log performance metrics
export const logPerformance = (
  operation: string,
  duration: number,
  metadata: any = {}
) => {
  logger.info({
    message: `Performance: ${operation}`,
    duration: `${duration}ms`,
    ...metadata,
  })
}

// Log business events
export const logBusinessEvent = (
  event: string,
  data: any = {}
) => {
  logger.info({
    message: `Business Event: ${event}`,
    ...data,
  })
}

// Development helper to log objects
export const debugLog = (label: string, data: any) => {
  if (process.env.NODE_ENV === 'development') {
    logger.debug({
      message: `Debug: ${label}`,
      data: JSON.stringify(data, null, 2),
    })
  }
} 