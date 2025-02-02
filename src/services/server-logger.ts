import path from 'path'
import fs from 'fs/promises'
import fetch from 'node-fetch'

interface LogEntry {
  timestamp: string;
  level: string;
  type: string;
  message: string;
  error?: {
    message: string;
    stack?: string;
  };
  count?: number;
  window?: number;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

const MAX_LOG_SIZE = 1024 * 1024 // 1MB

export class ServerLogger {
  private static instance: ServerLogger
  private testMode = false
  private errorCounts: { timestamp: number }[] = []
  private readonly ALERT_THRESHOLD = 5
  private readonly ALERT_WINDOW = 60000 // 1 minute
  private logDir: string
  private context: Record<string, any>
  private lastAlertTime: number
  private logApiUrl: string
  private pendingWrites: Promise<void>[] = []
  private initialized = false
  private logContent: { [key: string]: string } = {}
  private errorState: { errors: number[]; lastAlert: number } = { errors: [], lastAlert: 0 }
  private maxFileSize: number
  private rotatedFiles: string[] = []
  private shouldSimulateError = false
  private errorWindowMs = 60000 // 1 minute
  private recentErrors: number[] = []

  private constructor() {
    this.logDir = path.join(process.cwd(), 'logs')
    this.context = {}
    this.lastAlertTime = 0
    this.logApiUrl = process.env.LOG_API_URL || 'http://localhost:3001/api/logs'
    this.maxFileSize = MAX_LOG_SIZE
  }

  public static getInstance(): ServerLogger {
    if (!ServerLogger.instance) {
      ServerLogger.instance = new ServerLogger()
    }
    return ServerLogger.instance
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await fs.mkdir(this.logDir, { recursive: true })
      const appLogPath = path.join(this.logDir, 'app.log')
      const errorLogPath = path.join(this.logDir, 'error.log')
      
      // Initialize empty log content
      this.logContent[appLogPath] = ''
      this.logContent[errorLogPath] = ''
      
      // Create empty log files
      await fs.writeFile(appLogPath, '')
      await fs.writeFile(errorLogPath, '')
      
      this.initialized = true
    }
  }

  public async setTestMode(enabled: boolean): Promise<void> {
    this.testMode = enabled;
    this.initialized = false;
    this.logContent = {};
    this.errorCounts = [];
    this.rotatedFiles = [];
    this.pendingWrites = [];
    this.shouldSimulateError = false;
    this.lastAlertTime = 0;
    
    if (enabled) {
      this.logDir = path.join(process.cwd(), 'test-logs');
      
      // Initialize log files for test mode
      await fs.mkdir(this.logDir, { recursive: true });
      const appLogPath = path.join(this.logDir, 'app.log');
      const errorLogPath = path.join(this.logDir, 'error.log');
      
      // Initialize empty log content
      this.logContent[appLogPath] = '';
      this.logContent[errorLogPath] = '';
      
      // Create empty log files (needed for mocks)
      await fs.writeFile(appLogPath, '');
      await fs.writeFile(errorLogPath, '');
    } else {
      this.logDir = path.join(process.cwd(), 'logs');
    }
    
    this.initialized = true;
  }

  private async handleWrite(logEntry: LogEntry, logPath: string): Promise<void> {
    if (this.testMode) {
      if (this.shouldSimulateError) {
        throw new Error('Simulated file system error in test mode');
      }
      this.logContent[logPath] = this.logContent[logPath] || '';
      this.logContent[logPath] += JSON.stringify(logEntry) + '\n';
      return;
    }
    // ... existing code ...
  }

  private async writeToFile(logPath: string, content: string): Promise<void> {
    await this.ensureInitialized();
    
    // Initialize log content for test mode
    if (this.testMode && !this.logContent[logPath]) {
      this.logContent[logPath] = '';
    }

    try {
      // Check if rotation is needed before writing
      const currentSize = this.testMode 
        ? Buffer.from(this.logContent[logPath] || '').length
        : (await fs.stat(logPath)).size;

      if (currentSize >= this.maxFileSize) {
        await this.rotateLogFile(logPath);
      }

      // Write the log entry
      if (this.testMode) {
        this.logContent[logPath] = (this.logContent[logPath] || '') + content + '\n';
      } else {
        await fs.appendFile(logPath, content + '\n');
      }

      // If this is an error log, check the threshold
      if (logPath.endsWith('error.log') && content.includes('"level":"error"')) {
        await this.checkErrorThreshold();
      }
    } catch (error: unknown) {
      // Always throw in test mode
      if (this.testMode) {
        throw error;
      }
      throw error;
    }
  }

  private async rotateLogFile(logPath: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = `${logPath}.${timestamp}`;
      
      if (this.testMode) {
        // Copy current content to rotated file
        this.logContent[rotatedPath] = this.logContent[logPath] || '';
        // Clear current log file
        this.logContent[logPath] = '';
        // Add to rotated files list if not already present
        if (!this.rotatedFiles.includes(rotatedPath)) {
          this.rotatedFiles.push(rotatedPath);
        }
      } else {
        await fs.copyFile(logPath, rotatedPath);
        await fs.writeFile(logPath, '');
        if (!this.rotatedFiles.includes(rotatedPath)) {
          this.rotatedFiles.push(rotatedPath);
        }
      }
    } catch (error: unknown) {
      // Always throw in test mode
      if (this.testMode) {
        throw error;
      }
      throw error;
    }
  }

  private async checkErrorThreshold(): Promise<void> {
    const currentTime = Date.now();
    
    // Remove old errors outside the time window
    this.errorCounts = this.errorCounts.filter(
      entry => currentTime - entry.timestamp < this.ALERT_WINDOW
    );
    
    // Add current error
    this.errorCounts.push({ timestamp: currentTime });
    
    // Check if we need to trigger an alert
    if (
      this.errorCounts.length >= this.ALERT_THRESHOLD &&
      (currentTime - this.lastAlertTime >= this.ALERT_WINDOW || !this.lastAlertTime)
    ) {
      const alertEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        type: 'alert',
        level: 'error',
        message: `Error threshold exceeded: ${this.errorCounts.length} errors in ${this.ALERT_WINDOW / 1000}s`,
        count: this.errorCounts.length,
        window: this.ALERT_WINDOW
      };
      
      // Write alert entry to log file
      const logPath = path.join(this.logDir, 'error.log');
      await this.writeToFile(logPath, JSON.stringify(alertEntry));
      this.lastAlertTime = currentTime;
      
      // Reset error counts after alert
      this.errorCounts = [];
    }
  }

  public async info(message: string, data: Record<string, any> = {}): Promise<void> {
    await this.ensureInitialized();

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'log',
      message,
      ...this.context,
      ...data
    };

    try {
      const logPath = path.join(this.logDir, 'app.log');
      await this.writeToFile(logPath, JSON.stringify(logEntry));
      
      if (!this.testMode) {
        await this.sendToLogApi('info', message, logEntry);
      }
    } catch (error: unknown) {
      // Always throw in test mode
      if (this.testMode) {
        throw error;
      }
      throw error;
    }
  }

  public async warn(message: string, data: Record<string, any> = {}): Promise<void> {
    await this.ensureInitialized();

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type: 'log',
      message,
      ...this.context,
      ...data
    };

    try {
      const logPath = path.join(this.logDir, 'app.log');
      await this.writeToFile(logPath, JSON.stringify(logEntry));
      
      if (!this.testMode) {
        await this.sendToLogApi('warn', message, logEntry);
      }
    } catch (error: unknown) {
      // Always throw in test mode
      if (this.testMode) {
        throw error;
      }
      throw error;
    }
  }

  public async debug(message: string, data: Record<string, any> = {}): Promise<void> {
    await this.ensureInitialized();

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      type: 'log',
      message,
      ...this.context,
      ...data
    };

    try {
      const logPath = path.join(this.logDir, 'app.log');
      await this.writeToFile(logPath, JSON.stringify(logEntry));
      
      if (!this.testMode) {
        await this.sendToLogApi('debug', message, logEntry);
      }
    } catch (error: unknown) {
      // Always throw in test mode
      if (this.testMode) {
        throw error;
      }
      throw error;
    }
  }

  public async error(message: string, error?: Error): Promise<void> {
    await this.ensureInitialized();
    await this.checkErrorThreshold();

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'error',
      message,
      error: error ? {
        message: error.message,
        stack: error.stack
      } : undefined,
      ...this.context
    };

    try {
      const logPath = path.join(this.logDir, 'error.log');
      await this.writeToFile(logPath, JSON.stringify(logEntry));
      
      if (!this.testMode) {
        await this.sendToLogApi('error', message, logEntry);
      }
    } catch (error: unknown) {
      // Always throw in test mode
      if (this.testMode) {
        throw error;
      }
      throw error;
    }
  }

  public async logPerformance(operation: string, duration: number, data: Record<string, any> = {}): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'performance',
      operation,
      duration,
      ...this.context,
      ...data
    }

    await this.writeToFile(path.join(this.logDir, 'app.log'), JSON.stringify(logEntry))
    
    if (!this.testMode) {
      await this.sendToLogApi('info', `Performance: ${operation}`, logEntry, 'performance')
    }
  }

  public async waitForWrites(): Promise<void> {
    try {
      await Promise.all(this.pendingWrites);
    } finally {
      this.pendingWrites = [];
    }
  }

  private async sendToLogApi(level: string, message: string, data: any, type: string = 'log'): Promise<void> {
    if (this.testMode) {
      return;
    }

    try {
      const response = await fetch(this.logApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          level,
          message,
          data,
          type,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send log to API: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending log to API:', error);
    }
  }

  public setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context }
  }

  public clearContext(): void {
    this.context = {}
  }

  public clearErrorCount(): void {
    this.recentErrors = []
  }

  public getLogContent(): { [key: string]: string } {
    return this.logContent
  }

  public getLogDir(): string {
    return this.logDir
  }

  private getLogPath(): string {
    return path.join(this.logDir, 'error.log')
  }

  public getRotatedFiles(): string[] {
    return this.rotatedFiles;
  }
}

export default ServerLogger.getInstance()