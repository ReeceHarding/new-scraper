import path from 'path'
import { promises as fsPromises } from 'fs'

// Dynamic imports for Node.js modules
let _fsPromises: any;

const _initializeFs = async () => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const _fs = await import('fs');
      _fsPromises = _fs.promises;
      return true;
    } catch {
      console.error('Failed to load fs modules');
      return false;
    }
  }
  return true; // Return true in test mode
};

// Initialize fs modules
let _fsInitialized = false;

const initializeFs = async () => {
  if (!_fsInitialized) {
    _fsInitialized = await _initializeFs();
  }
  return _fsInitialized;
};

interface LogEntry {
  timestamp: string;
  level: string;
  type: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    originalError?: any;
  };
  count?: number;
  window?: number;
  operation?: string;
  duration?: number;
  _errorTracked?: boolean;
  _isAdditionalError?: boolean;
  [key: string]: any;
}

const MAX_LOG_SIZE = 1024 * 1024 // 1MB
const DEFAULT_LOG_DIR = process.env.NODE_ENV === 'test' ? './test-logs' : './logs'
const DEFAULT_LOG_API_URL = 'http://localhost:3001/api/logs'

export class ServerLogger {
  private static instance: ServerLogger
  private testMode: boolean = false
  private errorCounts: { timestamp: number }[] = []
  private readonly ALERT_THRESHOLD = 5
  private readonly ALERT_WINDOW = 60000 // 1 minute
  private testAlertWindow: number = 60000
  private logDir: string = DEFAULT_LOG_DIR
  private context: Record<string, any> = {}
  private lastAlertTime: number = 0
  private logContent: { [key: string]: string } = {}
  private initialized: boolean = false
  private logApiUrl: string = DEFAULT_LOG_API_URL
  private pendingWrites: Promise<void>[] = []
  private maxFileSize: number = MAX_LOG_SIZE
  private rotatedFiles: string[] = []
  private shouldSimulateError = false
  private errorWindowMs = 60000 // 1 minute
  private recentErrors: number[] = []
  private isProcessingAlert = false
  private errorThreshold: number = 5
  private errorThresholdWindow: number = 60000 // 60 seconds
  private errorTimestamps: number[] = []

  private constructor() {
    if (process.env.NODE_ENV === 'test') {
      this.testMode = true;
    }
    this.ensureLogDirectoryExists().catch(console.error)
  }

  public static getInstance(): ServerLogger {
    if (!ServerLogger.instance) {
      ServerLogger.instance = new ServerLogger()
    }
    return ServerLogger.instance
  }

  private async ensureLogDirectoryExists(): Promise<void> {
    try {
      if (!this.testMode) {
        await fsPromises.mkdir(this.logDir, { recursive: true })
      }
      this.initialized = true
      await initializeFs()
    } catch (error) {
      console.error('Failed to create log directory:', error)
      throw error
    }
  }

  private async writeToFile(logEntry: LogEntry, type: 'app' | 'error'): Promise<void> {
    if (this.shouldSimulateError) {
      throw new Error('Simulated error in test mode')
    }

    const logString = JSON.stringify(logEntry) + '\n'
    const filename = `${type}.log`
    const fullPath = path.join(this.logDir, filename)

    // In test mode, just update the in-memory content
    if (this.testMode) {
      if (!this.logContent[filename]) {
        this.logContent[filename] = ''
      }
      if (!this.logContent[fullPath]) {
        this.logContent[fullPath] = ''
      }
      
      this.logContent[filename] += logString
      this.logContent[fullPath] += logString
      
      // Check if rotation is needed in test mode
      if (this.logContent[filename].length > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const rotatedPath = `${fullPath}.${timestamp}`
        this.logContent[rotatedPath] = this.logContent[filename]
        this.rotatedFiles.push(rotatedPath)
        this.logContent[filename] = ''
        this.logContent[fullPath] = ''
      }
      return
    }

    // Production mode
    try {
      await this.ensureLogDirectoryExists()
      
      // Create write promise
      const writePromise = fsPromises.appendFile(fullPath, logString)
        .then(async () => {
          // Check if rotation is needed
          const stats = await fsPromises.stat(fullPath)
          if (stats.size > this.maxFileSize) {
            await this.rotateLogFile(fullPath)
          }
        })
        .catch(error => {
          console.error(`Failed to write to log file ${fullPath}:`, error)
        })

      // Add to pending writes
      await this.addPendingWrite(writePromise)
    } catch (error) {
      console.error(`Failed to write to log file ${fullPath}:`, error)
    }
  }

  private async rotateLogFile(logPath: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const rotatedPath = `${logPath}.${timestamp}`
      
      await fsPromises.rename(logPath, rotatedPath)
      this.rotatedFiles.push(rotatedPath)
      
      // Create a new empty log file
      await fsPromises.writeFile(logPath, '')
    } catch (error) {
      console.error(`Failed to rotate log file ${logPath}:`, error)
    }
  }

  private async addPendingWrite(writePromise: Promise<void>): Promise<void> {
    this.pendingWrites.push(writePromise)
    await writePromise
    const index = this.pendingWrites.indexOf(writePromise)
    if (index > -1) {
      this.pendingWrites.splice(index, 1)
    }
  }

  private async checkErrorThreshold(timestamp: number): Promise<void> {
    const now = Date.now()
    this.errorTimestamps = this.errorTimestamps.filter(t => now - t < this.errorThresholdWindow)
    this.errorTimestamps.push(timestamp)

    if (this.errorTimestamps.length >= this.errorThreshold && !this.isProcessingAlert) {
      this.isProcessingAlert = true
      try {
        await this.triggerAlert('Error threshold exceeded')
      } finally {
        this.isProcessingAlert = false
      }
    }
  }

  private async triggerAlert(message: string): Promise<void> {
    const now = Date.now()
    const timeSinceLastAlert = now - this.lastAlertTime

    if (timeSinceLastAlert >= this.testAlertWindow) {
      const alertEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'alert',
        type: 'alert',
        message: `${message}: ${this.errorTimestamps.length} errors in ${this.errorThresholdWindow}ms`,
        count: this.errorTimestamps.length,
        window: this.errorThresholdWindow
      }

      await this.writeToFile(alertEntry, 'error')
      this.lastAlertTime = now
    }
  }

  public async error(message: string, error?: Error | unknown, metadata: Record<string, any> = {}): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error))
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'error',
      message,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack
      },
      ...this.context,
      ...metadata
    }

    await this.writeToFile(logEntry, 'error')
    await this.checkErrorThreshold(Date.now())
  }

  public async info(message: string, metadata: Record<string, any> = {}): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'info',
      message,
      ...this.context,
      ...metadata
    }

    await this.writeToFile(logEntry, 'app')
  }

  public async warn(message: string, metadata: Record<string, any> = {}): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type: 'warning',
      message,
      ...this.context,
      ...metadata
    }

    await this.writeToFile(logEntry, 'app')
  }

  public async debug(message: string, metadata: Record<string, any> = {}): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      type: 'debug',
      message,
      ...this.context,
      ...metadata
    }

    await this.writeToFile(logEntry, 'app')
  }

  public async logPerformance(operation: string, duration: number, metadata: Record<string, any> = {}): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'performance',
      message: `Performance measurement for ${operation}`,
      operation,
      duration,
      ...this.context,
      ...metadata
    }

    await this.writeToFile(logEntry, 'app')
  }

  public async performance(operation: string, duration: number, metadata: Record<string, any> = {}): Promise<void> {
    return this.logPerformance(operation, duration, metadata)
  }

  public setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context }
  }

  public clearContext(): void {
    this.context = {}
  }

  public clearLogContent(): void {
    this.logContent = {}
    const appLogPath = path.join(this.logDir, 'app.log')
    const errorLogPath = path.join(this.logDir, 'error.log')
    this.logContent['app.log'] = ''
    this.logContent['error.log'] = ''
    this.logContent[appLogPath] = ''
    this.logContent[errorLogPath] = ''
  }

  public clearErrorCount(): void {
    this.errorCounts = []
    this.lastAlertTime = 0
    this.errorTimestamps = []
  }

  public async simulateError(simulate: boolean): Promise<void> {
    await this.waitForWrites()
    this.shouldSimulateError = simulate
  }

  public setTestMode(enabled: boolean): void {
    this.testMode = enabled;
    if (enabled) {
      this.logContent = {};
      this.rotatedFiles = [];
    }
  }

  public async waitForWrites(): Promise<void> {
    await Promise.all(this.pendingWrites)
  }

  public getLogContent(): { [key: string]: string } {
    return this.logContent;
  }

  public getLogDir(): string {
    return this.logDir;
  }

  public getRotatedFiles(): string[] {
    return this.rotatedFiles;
  }
}

export default ServerLogger.getInstance()