export interface LogData {
  level: string;
  message: string;
  error?: {
    message: string;
    stack?: string;
    name?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export class ClientLogger {
  private static instance: ClientLogger;
  private context: Record<string, any>;

  private constructor() {
    this.context = {};
  }

  public static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger();
    }
    return ClientLogger.instance;
  }

  public setContext(context: Record<string, any>): void {
    this.context = context;
  }

  private formatLogData(level: string, message: string, data?: any): LogData {
    return {
      level,
      message,
      ...data,
      ...this.context,
      timestamp: new Date().toISOString()
    };
  }

  public info(message: string, data?: any): void {
    const logData = this.formatLogData('info', message, data);
    console.log('[Client]', logData);
  }

  public warn(message: string, data?: any): void {
    const logData = this.formatLogData('warn', message, data);
    console.warn('[Client]', logData);
  }

  public debug(message: string, data?: any): void {
    const logData = this.formatLogData('debug', message, data);
    console.debug('[Client]', logData);
  }

  public error(message: string, error?: Error | any): void {
    const errorObj = error instanceof Error ? {
      ...error,
      message: error.message,
      stack: error.stack,
      name: error.name
    } : {
      message: String(error),
      name: 'UnknownError'
    };

    const logData = this.formatLogData('error', message, { error: errorObj });
    console.error('[Client]', logData);
  }

  public logPerformance(operation: string, duration: number, data?: any): void {
    const logData = this.formatLogData('performance', `Performance monitoring: ${operation} took ${duration}ms`, {
      type: 'performance',
      operation,
      duration,
      ...data
    });
    console.log('[Client]', logData);
  }
}

// Export the singleton instance
const logger = ClientLogger.getInstance();
export default logger; 