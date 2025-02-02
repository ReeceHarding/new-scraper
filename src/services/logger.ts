import path from 'path'
import fs from 'fs'
import fetch from 'node-fetch'

const MAX_LOG_SIZE = 1024 * 1024 // 1MB

export class Logger {
  private static instance: Logger
  private isServer: boolean
  private isTestMode: boolean
  private errorCount: { [key: string]: number }
  private logDir: string
  private context: Record<string, any>
  private lastAlertTime: number

  private constructor() {
    this.isServer = typeof window === 'undefined'
    this.isTestMode = false
    this.errorCount = {}
    this.logDir = this.isServer ? path.join(process.cwd(), 'logs') : ''
    this.context = {}
    this.lastAlertTime = 0
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  public setTestMode(enabled: boolean): void {
    this.isTestMode = enabled
    if (enabled) {
      // In test mode, we want to write logs regardless of environment
      this.isServer = true
      this.logDir = path.join(process.cwd(), 'logs')
      // Ensure test log directory exists and is empty
      if (fs.existsSync(this.logDir)) {
        fs.rmSync(this.logDir, { recursive: true })
      }
      fs.mkdirSync(this.logDir, { recursive: true })
      // Create empty log files
      fs.writeFileSync(path.join(this.logDir, 'app.log'), '')
      fs.writeFileSync(path.join(this.logDir, 'error.log'), '')
    }
  }

  public setContext(context: Record<string, any>): void {
    this.context = context
  }

  public clearErrorCount(): void {
    this.errorCount = {}
    this.lastAlertTime = 0
  }

  private getLogDir(): string {
    if (!this.isServer && !this.isTestMode) return ''
    return this.logDir
  }

  private rotateLogFile(logFile: string): void {
    try {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile)
        if (stats.size >= MAX_LOG_SIZE) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
          const rotatedFile = logFile.replace('.log', `-${timestamp}.log`)
          fs.renameSync(logFile, rotatedFile)
          fs.writeFileSync(logFile, '')
        }
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error)
    }
  }

  private writeToFile(logData: any, isError: boolean = false): void {
    if (!this.isServer && !this.isTestMode) return

    try {
      const logDir = this.getLogDir()
      if (!logDir) return

      const fileName = isError ? 'error.log' : 'app.log'
      const logFile = path.join(logDir, fileName)
      
      // Check if we need to rotate the log file
      this.rotateLogFile(logFile)

      const logEntry = {
        ...logData,
        ...this.context,
        timestamp: logData.timestamp || new Date().toISOString()
      }

      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n')
    } catch (error) {
      console.error('Failed to write to log file:', error)
    }
  }

  private async sendToLogApi(level: string, message: string, data?: any, type: string = 'log'): Promise<void> {
    if (!this.isServer && !this.isTestMode) return

    const logData = {
      level,
      message,
      ...data,
      ...this.context,
      type,
      timestamp: new Date().toISOString()
    }

    // In test mode or server mode, write to file first
    if (this.isTestMode || this.isServer) {
      this.writeToFile(logData, level === 'error')
    }

    // Only try to send to API if not in test mode
    if (!this.isTestMode) {
      try {
        const logApiUrl = process.env.LOG_API_URL || 'http://localhost:3001/api/logs'
        await fetch(logApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(logData)
        })
      } catch (error) {
        console.error('Error sending log to API:', error)
      }
    }
  }

  private formatLogData(level: string, message: string, data?: any): any {
    return {
      level,
      message,
      ...data,
      ...this.context,
      timestamp: new Date().toISOString()
    }
  }

  public info(message: string, data?: any): void {
    const logData = this.formatLogData('info', message, data)
    console.log('[Client]', logData)
  }

  public warn(message: string, data?: any): void {
    const logData = this.formatLogData('warn', message, data)
    console.warn('[Client]', logData)
  }

  public debug(message: string, data?: any): void {
    const logData = this.formatLogData('debug', message, data)
    console.debug('[Client]', logData)
  }

  public error(error: Error | string, data?: any): void {
    const errorMessage = error instanceof Error ? error.message : error
    const logData = this.formatLogData('error', errorMessage, {
      error: errorMessage,
      ...(error instanceof Error && { stack: error.stack }),
      ...data
    })
    console.error('[Client]', logData)
  }

  private checkAlertThreshold(errorMessage: string, logData: any): void {
    if (!this.errorCount[errorMessage]) {
      this.errorCount[errorMessage] = 0
    }
    this.errorCount[errorMessage]++

    const now = Date.now()
    const alertCooldown = 60000 // 1 minute cooldown

    if (this.errorCount[errorMessage] >= 5 && now - this.lastAlertTime >= alertCooldown) {
      const alertData = {
        type: 'alert',
        level: 'error',
        message: 'Alert triggered',
        error: errorMessage,
        count: this.errorCount[errorMessage],
        timestamp: new Date().toISOString(),
        ...(logData.stack && { stack: logData.stack })
      }

      if (!this.isTestMode) {
        if (this.isServer) {
          this.sendToLogApi('alert', alertData.message, alertData, 'alert')
        } else {
          console.error('[Client] Alert:', alertData)
        }
      }

      if (this.isTestMode || this.isServer) {
        this.writeToFile(alertData)
      }

      this.lastAlertTime = now
      this.errorCount[errorMessage] = 0
    }
  }

  public logPerformance(operation: string, duration: number, data?: any): void {
    const logData = this.formatLogData('performance', `Performance monitoring: ${operation} took ${duration}ms`, {
      type: 'performance',
      operation,
      duration,
      ...data
    })
    console.log('[Client]', logData)
  }
}

// Export the singleton instance
const logger = Logger.getInstance()
export default logger 