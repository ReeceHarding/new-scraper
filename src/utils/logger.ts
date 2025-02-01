import winston from 'winston'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'

// Create logs directory if it doesn't exist
const logDir = join(process.cwd(), 'logs')
mkdirSync(logDir, { recursive: true })

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: join(logDir, 'combined.log')
    })
  ]
})

export { logger } 