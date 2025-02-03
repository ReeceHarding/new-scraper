import path from 'path'
import fs from 'fs/promises'
import fsSync from 'fs'
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

export class ServerLogger {
  private static instance: ServerLogger
  private testMode: boolean = false
  private errorCounts: { timestamp: number }[] = []
  private readonly ALERT_THRESHOLD = 5
  private readonly ALERT_WINDOW = 60000 // 1 minute
  private testAlertWindow: number = 60000 // Configurable alert window for test mode
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
    this.logDir = path.join(process.cwd(), this.testMode ? 'test-logs' : 'logs')
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
        // Initialize log content with empty strings in test mode
        this.logContent = {
          [appLogPath]: '',
          [errorLogPath]: ''
        };
        this.initialized = true;
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
        this.initialized = true;
      }
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
      this.errorThreshold = 5; // Reset error threshold
      this.errorThresholdWindow = 60000; // Reset window
      this.testAlertWindow = 0; // Allow alerts to trigger immediately in test mode
      
      // Create test log directory if it doesn't exist
      try {
        await fs.mkdir(this.logDir, { recursive: true });
      } catch {
        // Ignore directory exists error
      }
      
      // Initialize empty log content for test mode
      const appLogPath = path.join(this.logDir, 'app.log');
      const errorLogPath = path.join(this.logDir, 'error.log');
      
      // Initialize empty log content in memory
      this.logContent = {
        [appLogPath]: '',
        [errorLogPath]: ''
      };
      
      // Set initialized to true since we've set up the test environment
      this.initialized = true;
    } else {
      this.logDir = path.join(process.cwd(), 'logs');
      this.maxFileSize = MAX_LOG_SIZE;
      this.testAlertWindow = 60000; // Reset alert window for production
      // Initialize the logger with the new settings
      await this.ensureInitialized();
    }
  }

  public async simulateError(simulate: boolean): Promise<void> {
    await this.waitForWrites();
    this.shouldSimulateError = simulate;
  }

  private async writeToFile(logEntry: LogEntry, logPath: string): Promise<void> {
    await this.ensureInitialized();
    
    // Simulate error if needed before writing
    if (this.shouldSimulateError) {
      throw new Error('Simulated error in test mode');
    }
    
    // Create a new object without the timestamp from logEntry
    const { timestamp: _, ...logEntryWithoutTimestamp } = logEntry;
    
    // Ensure proper JSON formatting with context and timestamp
    const formattedEntry = {
      timestamp: new Date().toISOString(),
      ...this.context,
      ...logEntryWithoutTimestamp,
    };

    // Ensure the log line ends with a newline
    const logLine = JSON.stringify(formattedEntry) + '\n';

    try {
      if (this.testMode) {
        // In test mode, only write to memory
        const appLogPath = path.join(this.logDir, 'app.log');
        const errorLogPath = path.join(this.logDir, 'error.log');
        
        // Initialize log content for both files if needed
        if (!this.logContent[appLogPath]) {
          this.logContent[appLogPath] = '';
        }
        if (!this.logContent[errorLogPath]) {
          this.logContent[errorLogPath] = '';
        }

        // Write the log entry to the appropriate file
        const targetPath = (logEntry.level === 'error' || logEntry.type === 'alert') ? errorLogPath : appLogPath;
        
        // Append the log line to memory only
        this.logContent[targetPath] += logLine;
        
        // Check memory size and rotate if needed
        if (this.logContent[targetPath].length > this.maxFileSize) {
          await this.rotateLogFile(targetPath);
          // After rotation, write the current log entry
          this.logContent[targetPath] += logLine;
        }

        // Track error timestamps for alert notifications
        if (logEntry.level === 'error' && !logEntry._isAdditionalError) {
          const now = Date.now();
          this.errorTimestamps.push(now);
          
          // Clean up old timestamps
          this.errorTimestamps = this.errorTimestamps.filter(
            timestamp => now - timestamp < this.errorThresholdWindow
          );

          // Check if we need to trigger an alert
          if (this.errorTimestamps.length >= this.errorThreshold && !this.isProcessingAlert) {
            this.isProcessingAlert = true;
            try {
              const alertEntry: LogEntry = {
                timestamp: new Date().toISOString(),
                level: 'alert',
                type: 'alert',
                message: `Error threshold exceeded: ${this.errorTimestamps.length} errors in ${this.errorThresholdWindow}ms`,
                count: this.errorTimestamps.length,
                window: this.errorThresholdWindow
              };
              
              // Write alert to error log using writeToFile
              await this.writeToFile(alertEntry, errorLogPath);
            } finally {
              this.isProcessingAlert = false;
            }
          }
        }
      } else {
        // Check if file exists and get its size
        let stats;
        try {
          stats = await fs.stat(logPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            await fs.writeFile(logPath, '');
            stats = await fs.stat(logPath);
          } else {
            throw error;
          }
        }

        // Rotate if file size exceeds limit
        if (stats.size > this.maxFileSize) {
          await this.rotateLogFile(logPath);
        }

        // Append the log entry
        await fs.appendFile(logPath, logLine);

        // Send to log API if configured
        if (this.logApiUrl && !this.testMode) {
          try {
            await this.sendToLogApi(formattedEntry);
          } catch (error) {
            console.error('Error sending log to API:', error);
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error && (this.shouldSimulateError || error.message === 'Simulated rotation error in test mode')) {
        throw error;
      }
      console.error('Error writing to log file:', error);
      throw error;
    }
  }

  private async rotateLogFile(logPath: string): Promise<void> {
    try {
      if (this.testMode) {
        // In test mode, create a rotated file name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${logPath}.${timestamp}`;
        
        // Store current content in rotated file (in memory)
        this.logContent[rotatedPath] = this.logContent[logPath];
        
        // Clear current log file
        this.logContent[logPath] = '';
        
        // Track rotated files
        if (!this.rotatedFiles.includes(rotatedPath)) {
          this.rotatedFiles.push(rotatedPath);
        }
      } else {
        // Production mode - handle physical file rotation
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = `${logPath}.${timestamp}`;
        
        await fs.rename(logPath, rotatedPath);
        await fs.writeFile(logPath, ''); // Create new empty log file
        
        // Track rotated files
        if (!this.rotatedFiles.includes(rotatedPath)) {
          this.rotatedFiles.push(rotatedPath);
        }
      }
    } catch (error) {
      if (this.testMode && this.shouldSimulateError) {
        throw new Error('Simulated rotation error in test mode');
      }
      // Log rotation error but don't throw
      console.error('Error rotating log file:', error);
    }
  }

  private async checkErrorThreshold(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.errorThresholdWindow;
    
    // Filter out old errors and count recent ones
    this.errorTimestamps = this.errorTimestamps.filter(timestamp => timestamp > windowStart);
    
    // Check if we've exceeded the threshold and enough time has passed since last alert
    if (this.errorTimestamps.length >= this.errorThreshold && 
        (now - this.lastAlertTime) > (this.testMode ? 0 : this.ALERT_WINDOW)) {
      
      // Prevent concurrent alert processing
      if (this.isProcessingAlert) {
        return;
      }
      
      this.isProcessingAlert = true;
      try {
        const alertEntry: LogEntry = {
          timestamp: new Date().toISOString(),
          level: 'alert',
          type: 'alert',
          message: `Error threshold exceeded: ${this.errorTimestamps.length} errors in the last ${this.errorThresholdWindow / 1000} seconds`,
          count: this.errorTimestamps.length,
          window: this.errorThresholdWindow
        };
        
        const errorLogPath = path.join(this.logDir, 'error.log');
        await this.writeToFile(alertEntry, errorLogPath);
        
        // Update last alert time
        this.lastAlertTime = now;
        
        // Don't clear error timestamps in test mode to allow multiple alerts
        if (!this.testMode) {
          this.errorTimestamps = [];
        }
      } finally {
        this.isProcessingAlert = false;
      }
    }
  }

  public async error(message: string, error?: Error | unknown, metadata: Record<string, any> = {}): Promise<void> {
    const now = Date.now();
    
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'error',
      message,
      ...metadata
    };

    if (error instanceof Error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      logEntry.error = {
        name: 'UnknownError',
        message: String(error),
        originalError: error
      };
    }

    const errorLogPath = path.join(this.logDir, 'error.log');
    
    // Track error timestamp before writing to ensure it's counted
    if (!metadata._isAdditionalError) {
      this.errorTimestamps.push(now);
    }
    
    // Write the error log
    await this.writeToFile(logEntry, errorLogPath);
    
    // Check threshold after each error in test mode
    if (this.testMode && metadata._testThreshold) {
      await this.checkErrorThreshold();
    } else if (!this.testMode) {
      // In production, always check threshold
      await this.checkErrorThreshold();
    }
  }

  public async info(message: string, metadata: Record<string, any> = {}): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'info',
      message,
      ...metadata
    };

    const logPath = path.join(this.logDir, 'app.log');
    await this.writeToFile(logEntry, logPath);
  }

  public async warn(message: string, metadata: Record<string, any> = {}): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type: 'warning',
      message,
      ...metadata
    };

    const logPath = path.join(this.logDir, 'app.log');
    await this.writeToFile(logEntry, logPath);
  }

  public async debug(message: string, metadata: Record<string, any> = {}): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      type: 'debug',
      message,
      ...metadata
    };

    const logPath = path.join(this.logDir, 'app.log');
    await this.writeToFile(logEntry, logPath);
  }

  public async logPerformance(operation: string, duration: number, metadata: Record<string, any> = {}): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'performance',
      message: `Performance monitoring: ${operation} took ${duration}ms`,
      operation,
      duration,
      ...metadata
    };

    const logPath = path.join(this.logDir, 'app.log');
    await this.writeToFile(logEntry, logPath);
  }

  public async performance(operation: string, duration: number, metadata: Record<string, any> = {}): Promise<void> {
    return this.logPerformance(operation, duration, metadata);
  }

  public async waitForWrites(): Promise<void> {
    await Promise.all(this.pendingWrites);
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
    this.context = context;
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
    return this.rotatedFiles;
  }

  public clearLogContent(): void {
    this.logContent = {};
    const appLogPath = path.join(this.logDir, 'app.log');
    const errorLogPath = path.join(this.logDir, 'error.log');
    
    if (this.testMode) {
      this.logContent = {
        [appLogPath]: '',
        [errorLogPath]: ''
      };
      
      // Also clear physical files in test mode
      fsSync.writeFileSync(appLogPath, '');
      fsSync.writeFileSync(errorLogPath, '');
    }
  }

  public enableErrorSimulation(): void {
    this.shouldSimulateError = true;
  }

  public disableErrorSimulation(): void {
    this.shouldSimulateError = false;
  }
}

export default ServerLogger.getInstance()