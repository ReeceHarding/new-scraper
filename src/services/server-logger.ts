import path from 'path'
import fs from 'fs/promises'
import fetch from 'node-fetch'

interface LogEntry {
  timestamp: string;
  level: string;
  type: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  count?: number;
  window?: number;
  operation?: string;
  duration?: number;
  _errorTracked?: boolean;
  [key: string]: any;
}

const MAX_LOG_SIZE = 1024 * 1024 // 1MB

export class ServerLogger {
  private static instance: ServerLogger
  private testMode: boolean = false
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
  private isProcessingAlert = false
  private errorThreshold: number = 5
  private errorThresholdWindow: number = 60000 // 60 seconds
  private apiEndpoint: string = 'http://localhost:3001/api/logs'
  private errorTimestamps: number[] = []

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
      await fs.mkdir(this.logDir, { recursive: true });
      const appLogPath = path.join(this.logDir, 'app.log');
      const errorLogPath = path.join(this.logDir, 'error.log');
      
      if (this.testMode) {
        // Initialize empty log content for both paths
        this.logContent[appLogPath] = '';
        this.logContent[errorLogPath] = '';
      } else {
        // Only create physical files in non-test mode
        try {
          await fs.access(appLogPath);
        } catch {
          await fs.writeFile(appLogPath, '');
        }
        try {
          await fs.access(errorLogPath);
        } catch {
          await fs.writeFile(errorLogPath, '');
        }
      }
      
      this.initialized = true;
    }
  }

  private async addPendingWrite(writePromise: Promise<void>): Promise<void> {
    const write = writePromise.finally(() => {
      this.pendingWrites = this.pendingWrites.filter(p => p !== write);
    });
    this.pendingWrites.push(write);
    await write; // Wait for the write to complete
  }

  public async setTestMode(enabled: boolean): Promise<void> {
    // Wait for any pending operations to complete before switching modes
    await this.waitForWrites();
    
    this.testMode = enabled;
    this.initialized = false;
    
    // Clear all state
    this.logContent = {};
    this.errorCounts = [];
    this.rotatedFiles = [];
    this.lastAlertTime = 0;
    this.isProcessingAlert = false;
    this.shouldSimulateError = false;
    this.context = {};
    this.pendingWrites = [];
    this.errorTimestamps = [];
    
    if (enabled) {
      this.logDir = path.join(process.cwd(), 'test-logs');
      this.maxFileSize = 100; // Smaller size for testing
      
      // Initialize empty log files for test mode
      const appLogPath = path.join(this.logDir, 'app.log');
      const errorLogPath = path.join(this.logDir, 'error.log');
      
      // Ensure the test log directory exists
      await fs.mkdir(this.logDir, { recursive: true });
      
      // Initialize empty log content
      this.logContent[appLogPath] = '';
      this.logContent[errorLogPath] = '';
      
      // Set initialized to true since we've set up the test environment
      this.initialized = true;
    } else {
      this.logDir = path.join(process.cwd(), 'logs');
      this.maxFileSize = MAX_LOG_SIZE;
      // Initialize the logger with the new settings
      await this.ensureInitialized();
    }
  }

  public async simulateError(simulate: boolean): Promise<void> {
    this.shouldSimulateError = simulate;
    if (simulate) {
      // Clear any existing content to ensure clean state for error simulation
      this.logContent = {};
      this.rotatedFiles = [];
      this.recentErrors = [];
      this.lastAlertTime = 0;
      this.errorCounts = [];
      this.isProcessingAlert = false;
    }
  }

  private async rotateLogFile(logPath: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedPath = `${logPath}.${timestamp}`;
      
      if (this.testMode) {
        if (this.shouldSimulateError) {
          throw new Error('Simulated rotation error in test mode');
        }
        
        // Copy current content to rotated file
        this.logContent[rotatedPath] = this.logContent[logPath] || '';
        // Clear current log file
        this.logContent[logPath] = '';
        // Add to rotated files list
        if (!this.rotatedFiles.includes(rotatedPath)) {
          this.rotatedFiles.push(rotatedPath);
        }
      } else {
        // In non-test mode, ensure the file exists before rotating
        try {
          await fs.access(logPath);
          await fs.copyFile(logPath, rotatedPath);
          await fs.writeFile(logPath, '');
          if (!this.rotatedFiles.includes(rotatedPath)) {
            this.rotatedFiles.push(rotatedPath);
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
          // If file doesn't exist, just create an empty one
          await fs.writeFile(logPath, '');
        }
      }

      // Clean up old rotated files (keep last 5)
      const maxRotatedFiles = 5;
      if (this.rotatedFiles.length > maxRotatedFiles) {
        const filesToRemove = this.rotatedFiles.slice(0, this.rotatedFiles.length - maxRotatedFiles);
        this.rotatedFiles = this.rotatedFiles.slice(-maxRotatedFiles);
        
        for (const oldFile of filesToRemove) {
          if (this.testMode) {
            delete this.logContent[oldFile];
          } else {
            try {
              await fs.unlink(oldFile);
            } catch (error) {
              console.error(`Failed to delete old log file ${oldFile}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error during log rotation:', error);
      if (this.testMode) {
        throw error;
      }
    }
  }

  private async trackError(): Promise<void> {
    const now = Date.now();
    this.errorTimestamps.push(now);
    
    // Remove errors outside the window
    this.errorTimestamps = this.errorTimestamps.filter(
      timestamp => now - timestamp <= this.errorWindowMs
    );

    // Check if threshold is exceeded
    if (this.errorTimestamps.length >= this.errorThreshold) {
      const alertEntry: LogEntry = {
        type: 'alert',
        level: 'error',
        message: `Error threshold exceeded: ${this.errorTimestamps.length} errors in ${this.errorWindowMs / 1000} seconds`,
        count: this.errorTimestamps.length,
        window: this.errorWindowMs,
        timestamp: new Date().toISOString()
      };

      await this.writeToFile(alertEntry, path.join(this.logDir, 'error.log'));
      
      // Reset error timestamps after alert
      this.errorTimestamps = [];
    }
  }

  private async writeToFile(logEntry: LogEntry, logPath: string): Promise<void> {
    await this.ensureInitialized();
    
    // Ensure proper JSON formatting with context
    const formattedEntry = {
      ...logEntry,
      ...this.context,
      timestamp: logEntry.timestamp || new Date().toISOString()
    };
    
    const logString = JSON.stringify(formattedEntry) + '\n';
    
    try {
      if (this.testMode) {
        // In test mode, append to in-memory log content
        if (!this.logContent[logPath]) {
          this.logContent[logPath] = '';
        }
        this.logContent[logPath] += logString;
        
        // Check if we need to rotate in test mode
        if (this.logContent[logPath].length > this.maxFileSize) {
          await this.rotateLogFile(logPath);
        }

        // Track errors in test mode - only if not already being tracked
        if (logEntry.level === 'error' && !logEntry._errorTracked) {
          await this.trackError();
        }

        // Simulate error if needed
        if (this.shouldSimulateError) {
          throw new Error('Simulated error in test mode');
        }
      } else {
        // Production mode - write to actual file
        await fs.appendFile(logPath, logString);
        
        if (logEntry.level === 'error' && !logEntry._errorTracked) {
          await this.trackError();
        }

        // Only send to API in production mode
        if (this.logApiUrl) {
          await this.sendToLogApi(formattedEntry).catch(err => {
            console.error('Error sending log to API:', err);
          });
        }
      }
    } catch (error) {
      if (!this.testMode) {
        console.error('Error writing to log file:', error);
      }
      throw error;
    }
  }

  private async checkErrorThreshold(): Promise<void> {
    const now = Date.now();
    // Remove errors outside the window
    this.errorCounts = this.errorCounts.filter(
      count => now - count.timestamp < this.errorThresholdWindow
    );

    if (this.errorCounts.length >= this.errorThreshold && !this.isProcessingAlert) {
      this.isProcessingAlert = true;
      try {
        const alertEntry: LogEntry = {
          type: 'alert',
          level: 'error',
          message: `Error threshold exceeded: ${this.errorCounts.length} errors in ${this.errorThresholdWindow / 1000}s`,
          timestamp: new Date().toISOString(),
          count: this.errorCounts.length,
          window: this.errorThresholdWindow
        };

        const logPath = path.join(this.logDir, 'error.log');
        await this.writeToFile(alertEntry, logPath);
      } finally {
        this.isProcessingAlert = false;
      }
    }
  }

  public async error(message: string, error?: Error, data: Record<string, any> = {}): Promise<void> {
    await this.ensureInitialized();
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'error',
      message,
      _errorTracked: true,
      ...data
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    const logPath = path.join(this.logDir, 'error.log');
    const writePromise = this.writeToFile(logEntry, logPath);
    await this.addPendingWrite(writePromise);
  }

  public async info(message: string, data: Record<string, any> = {}): Promise<void> {
    await this.ensureInitialized();
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'info',
      message,
      ...data
    };

    const logPath = path.join(this.logDir, 'app.log');
    const writePromise = this.writeToFile(logEntry, logPath);
    await this.addPendingWrite(writePromise);
  }

  public async warn(message: string, data: Record<string, any> = {}): Promise<void> {
    await this.ensureInitialized();
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type: 'warn',
      message,
      ...data
    };

    const logPath = path.join(this.logDir, 'app.log');
    const writePromise = this.writeToFile(logEntry, logPath);
    await this.addPendingWrite(writePromise);
  }

  public async debug(message: string, data: Record<string, any> = {}): Promise<void> {
    await this.ensureInitialized();
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      type: 'debug',
      message,
      ...data
    };

    const logPath = path.join(this.logDir, 'app.log');
    const writePromise = this.writeToFile(logEntry, logPath);
    await this.addPendingWrite(writePromise);
  }

  public async logPerformance(operation: string, duration: number, data: Record<string, any> = {}): Promise<void> {
    await this.ensureInitialized();
    const performanceEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: 'performance',
      level: 'info',
      message: `Performance metrics for ${operation}`,
      operation,
      duration,
      ...data
    };

    const logPath = path.join(this.logDir, 'app.log');
    const writePromise = this.writeToFile(performanceEntry, logPath);
    await this.addPendingWrite(writePromise);
  }

  public async waitForWrites(): Promise<void> {
    if (this.pendingWrites.length > 0) {
      try {
        await Promise.all(this.pendingWrites.map(p => p.catch(() => {})));
      } finally {
        this.pendingWrites = [];
      }
    }
  }

  private async sendToLogApi(logEntry: LogEntry): Promise<void> {
    if (!this.testMode && this.logApiUrl) {
      try {
        const response = await fetch(this.logApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(logEntry)
        });

        if (!response.ok) {
          throw new Error(`Failed to send log to API: ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error sending log to API:', error);
      }
    }
  }

  public setContext(context: Record<string, any>): void {
    this.context = { ...context };
  }

  public clearContext(): void {
    this.context = {};
  }

  public clearErrorCount(): void {
    this.errorCounts = [];
    this.lastAlertTime = 0;
  }

  public getLogContent(): { [key: string]: string } {
    return { ...this.logContent };
  }

  public getLogDir(): string {
    return this.logDir;
  }

  private getLogPath(): string {
    return path.join(this.logDir, 'app.log');
  }

  public getRotatedFiles(): string[] {
    return [...this.rotatedFiles];
  }

  public clearLogContent(): void {
    const appLogPath = path.join(this.logDir, 'app.log');
    const errorLogPath = path.join(this.logDir, 'error.log');
    this.logContent = {
      [appLogPath]: '',
      [errorLogPath]: ''
    };
  }

  public enableErrorSimulation(): void {
    this.shouldSimulateError = true;
  }

  public disableErrorSimulation(): void {
    this.shouldSimulateError = false;
  }
}

export default ServerLogger.getInstance()