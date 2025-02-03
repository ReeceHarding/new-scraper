import { ServerLogger } from '../server-logger';
import path from 'path';

describe('ServerLogger', () => {
  let logger: ServerLogger;

  beforeEach(async () => {
    logger = ServerLogger.getInstance();
    await logger.setTestMode(true);
  });

  afterEach(async () => {
    await logger.waitForWrites();
  });

  describe('Basic Logging', () => {
    it('should log info messages', async () => {
      const message = 'Test info message';
      const key = 'value';
      await logger.info(message, { key });
      await logger.waitForWrites();

      const content = logger.getLogContent();
      const logPath = path.join(logger.getLogDir(), 'app.log');
      const logs = content[logPath].trim().split('\n');
      const lastLog = JSON.parse(logs[logs.length - 1]);
      expect(lastLog.message).toBe(message);
      expect(lastLog.level).toBe('info');
      expect(lastLog.key).toBe('value');
    });

    it('should log error messages', async () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      await logger.error(message, error);
      await logger.waitForWrites();

      const content = logger.getLogContent();
      const logPath = path.join(logger.getLogDir(), 'error.log');
      const logs = content[logPath].trim().split('\n');
      const lastLog = JSON.parse(logs[logs.length - 1]);
      expect(lastLog.message).toBe(message);
      expect(lastLog.level).toBe('error');
      expect(lastLog.error.message).toBe('Test error');
    });
  });

  describe('Log Rotation', () => {
    it('should rotate logs when size exceeds limit', async () => {
      // Write enough logs to trigger rotation
      for (let i = 0; i < 10; i++) {
        await logger.info('Test message ' + i);
      }
      await logger.info('New message after rotation');
      await logger.waitForWrites();

      const content = logger.getLogContent();
      const logPath = path.join(logger.getLogDir(), 'app.log');
      expect(content[logPath]).toContain('New message after rotation');
    });
  });

  describe('Error Threshold', () => {
    it('should trigger alert when error threshold is exceeded', async () => {
      // Generate enough errors to trigger alert
      for (let i = 0; i < 6; i++) {
        await logger.error('Test error ' + i);
      }
      await logger.waitForWrites();

      const content = logger.getLogContent();
      const logPath = path.join(logger.getLogDir(), 'error.log');
      const logs = content[logPath].trim().split('\n');
      const alertLog = logs.find(log => JSON.parse(log).type === 'alert');
      expect(alertLog).toBeDefined();
      expect(JSON.parse(alertLog!).message).toContain('Error threshold exceeded');
    }, 10000);
  });

  describe('Context Management', () => {
    it('should include context in logs', async () => {
      logger.setContext({ userId: '123', session: 'abc' });
      await logger.info('Test message with context');
      await logger.waitForWrites();

      const content = logger.getLogContent();
      const logPath = path.join(logger.getLogDir(), 'app.log');
      const logs = content[logPath].trim().split('\n');
      const lastLog = JSON.parse(logs[logs.length - 1]);
      expect(lastLog.userId).toBe('123');
      expect(lastLog.session).toBe('abc');
    });

    it('should clear context', async () => {
      logger.setContext({ userId: '123' });
      logger.clearContext();
      await logger.info('Test message without context');
      await logger.waitForWrites();

      const content = logger.getLogContent();
      const logPath = path.join(logger.getLogDir(), 'app.log');
      const logs = content[logPath].trim().split('\n');
      const lastLog = JSON.parse(logs[logs.length - 1]);
      expect(lastLog.userId).toBeUndefined();
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', async () => {
      const operation = 'test-operation';
      const duration = 100;
      await logger.logPerformance(operation, duration, { extra: 'data' });
      await logger.waitForWrites();

      const content = logger.getLogContent();
      const logPath = path.join(logger.getLogDir(), 'app.log');
      const logs = content[logPath].trim().split('\n');
      const lastLog = JSON.parse(logs[logs.length - 1]);
      expect(lastLog.type).toBe('performance');
      expect(lastLog.operation).toBe(operation);
      expect(lastLog.duration).toBe(duration);
      expect(lastLog.extra).toBe('data');
    });
  });
});
