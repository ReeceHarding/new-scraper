import type { NextApiRequest, NextApiResponse } from 'next'
import winston from 'winston'
import path from 'path'
import fs from 'fs'

const logDir = path.join(process.cwd(), 'logs')

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'app.log') })
  ]
})

// Create symlinks in production
if (process.env.NODE_ENV === 'production') {
  const createSymlink = (prefix: string) => {
    const currentDate = new Date().toISOString().split('T')[0]
    const logFile = path.join(logDir, `${prefix}-${currentDate}.log`)
    const symlinkPath = path.join(logDir, `${prefix}.log`)

    // Create empty log file if it doesn't exist
    if (!fs.existsSync(logFile)) {
      fs.writeFileSync(logFile, '')
    }

    // Update symlink
    try {
      if (fs.existsSync(symlinkPath)) {
        fs.unlinkSync(symlinkPath)
      }
      fs.symlinkSync(logFile, symlinkPath)
    } catch (error) {
      console.error('Error creating symlink:', error)
    }
  }

  createSymlink('app')
  createSymlink('error')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { level, message, metadata = {}, type } = req.body

    if (!level || !message) {
      return res.status(400).json({ message: 'Missing required fields' })
    }

    const logData = {
      level,
      ...(typeof message === 'string' ? { message } : message),
      ...metadata,
      type,
      timestamp: new Date().toISOString()
    }

    switch (level) {
      case 'info':
        logger.info(logData)
        break
      case 'error':
        logger.error(logData)
        break
      case 'warn':
        logger.warn(logData)
        break
      case 'debug':
        logger.debug(logData)
        break
      default:
        logger.info(logData)
    }

    res.status(200).json({ message: 'Log recorded successfully' })
  } catch (error) {
    console.error('Error logging message:', error)
    res.status(500).json({ message: 'Error logging message' })
  }
} 