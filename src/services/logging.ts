interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

export const logger: Logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({ level: 'info', message, meta, timestamp: new Date().toISOString() }));
  },
  error: (message: string, meta?: any) => {
    console.error(JSON.stringify({ level: 'error', message, meta, timestamp: new Date().toISOString() }));
  },
  warn: (message: string, meta?: any) => {
    console.warn(JSON.stringify({ level: 'warn', message, meta, timestamp: new Date().toISOString() }));
  },
  debug: (message: string, meta?: any) => {
    console.debug(JSON.stringify({ level: 'debug', message, meta, timestamp: new Date().toISOString() }));
  },
};

export const createContextLogger = (context: string): Logger => {
  return {
    info: (message: string, meta?: any) => logger.info(message, { ...meta, context }),
    error: (message: string, meta?: any) => logger.error(message, { ...meta, context }),
    warn: (message: string, meta?: any) => logger.warn(message, { ...meta, context }),
    debug: (message: string, meta?: any) => logger.debug(message, { ...meta, context }),
  };
};

export const dbLogger = createContextLogger('database');
export const migrationLogger = createContextLogger('migrations');
export const scrapingLogger = createContextLogger('scraping');
export const emailLogger = createContextLogger('email');
export const authLogger = createContextLogger('auth'); 