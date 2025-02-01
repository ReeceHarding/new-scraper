import { validateEnv } from '../env'
import { ConfigError } from '../errors'
import * as fs from 'fs'
import path from 'path'
import * as winston from 'winston'
import { baseLogger, initializeLogger } from '../logging'

// Create a temporary logger for initialization
const tempLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple(),
    winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
})

/**
 * Initialize core application services
 * This function should be called when the application starts
 */
export async function initializeApp(): Promise<void> {
  try {
    // Step 1: Validate environment variables
    tempLogger.info('Validating environment variables...')
    try {
      validateEnv()
      tempLogger.info('Environment variables validated successfully')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Environment validation failed'
      baseLogger.error(message, { error, context: 'app-init' })
      throw new ConfigError(`Application initialization failed: ${message}`)
    }

    // Step 2: Ensure log directory exists
    tempLogger.info('Setting up logging...')
    const logDir = process.env.LOG_DIR
    if (!logDir) {
      const message = 'LOG_DIR environment variable is not set'
      baseLogger.error(message, { context: 'app-init' })
      throw new ConfigError(`Application initialization failed: ${message}`)
    }

    // Check if directory exists and create it if it doesn't
    try {
      const exists = fs.existsSync(logDir)
      if (!exists) {
        await fs.promises.mkdir(logDir, { recursive: true })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const errorMessage = `Failed to create log directory: ${message}`
      baseLogger.error(errorMessage, {
        error,
        context: 'app-init'
      })
      throw new ConfigError(`Application initialization failed: ${errorMessage}`)
    }
    
    // Step 3: Initialize main logger
    await initializeLogger()
    tempLogger.info('Logging setup complete')

    // Step 4: Log successful initialization
    baseLogger.info('Core services initialized successfully', { context: 'app-init' })
  } catch (error) {
    if (error instanceof ConfigError) {
      if (!error.message.startsWith('Application initialization failed:')) {
        throw new ConfigError(`Application initialization failed: ${error.message}`)
      }
      throw error
    }
    const message = error instanceof Error ? error.message : 'Unknown initialization error'
    baseLogger.error(message, { error, context: 'app-init' })
    throw new ConfigError(`Application initialization failed: ${message}`)
  }
}

// Register cleanup handlers
const cleanupHandlers: Array<() => Promise<void>> = []

/**
 * Register a cleanup handler to be called during shutdown
 */
export function registerCleanupHandler(handler: () => Promise<void>): void {
  cleanupHandlers.push(handler)
}

/**
 * Shutdown the application gracefully
 */
export async function shutdownApp(): Promise<void> {
  try {
    tempLogger.info('Starting application shutdown...')
    
    // Execute all cleanup handlers
    for (const handler of cleanupHandlers) {
      await handler()
    }
    
    tempLogger.info('Application shutdown complete')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown shutdown error'
    tempLogger.error(`Error during shutdown: ${message}`)
    throw error
  }
}

// Export initialization function for tests
export const initializeCore = initializeApp 