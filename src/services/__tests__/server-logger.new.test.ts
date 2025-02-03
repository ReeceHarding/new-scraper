import { ServerLogger } from '../server-logger';

describe('ServerLogger', () => {
  let logger: ServerLogger;

  beforeEach(async () => {
    logger = ServerLogger.getInstance();
    await logger.setTestMode(true);
  });

  afterEach(async () => {
    await logger.setTestMode(false);
  });

  describe('Basic Logging', () => {
    test('should log info messages', async () => {
      const message = 'Test info message';
      const context = { key: 'value' };
      
      logger.setContext(context);
      await logger.info(message);
      await logger.waitForWrites();
      
      const content = logger.getLogContent();
      const logs = content['app.log'].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.message).toBe(message);
      expect(lastLog.level).toBe('info');
      expect(lastLog.key).toBe('value');
    });

    test('should log error messages', async () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      
      await logger.error(message, error);
      await logger.waitForWrites();
      
      const content = logger.getLogContent();
      const logs = content['error.log'].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.message).toBe(message);
      expect(lastLog.level).toBe('error');
      expect(lastLog.error.message).toBe('Test error');
    });
  });

  describe('Log Rotation', () => {
    test('should rotate logs when size exceeds limit', async () => {
      // Write enough logs to trigger rotation
      for (let i = 0; i < 10; i++) {
        await logger.info('Test message ' + i);
      }
      await logger.waitForWrites();
      
      // Write one more message after rotation
      await logger.info('New message after rotation');
      await logger.waitForWrites();
      
      const content = logger.getLogContent();
      const logs = content['app.log'].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      expect(lastLog.message).toBe('New message after rotation');
    });
  });

  describe('Error Threshold', () => {
    test('should trigger alert when error threshold is exceeded', async () => {
      // Generate enough errors to trigger alert
      for (let i = 0; i < 6; i++) {
        await logger.error('Test error ' + i, new Error('Test error'), { _testThreshold: true });
        await logger.waitForWrites();
      }
      
      const content = logger.getLogContent();
      const logs = content['error.log'].trim().split('\n');
      
      // Find all alert logs
      const alertLogs = logs.filter(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.type === 'alert';
        } catch {
          return false;
        }
      });
      
      expect(alertLogs.length).toBeGreaterThan(0);
      const parsedAlert = JSON.parse(alertLogs[0]);
      expect(parsedAlert).toMatchObject({
        type: 'alert',
        level: 'alert'
      });
    });
  });

  describe('Context Management', () => {
    test('should include context in logs', async () => {
      logger.setContext({ userId: '123', session: 'abc' });
      await logger.info('Test message');
      await logger.waitForWrites();
      
      const content = logger.getLogContent();
      const logs = content['app.log'].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.userId).toBe('123');
      expect(lastLog.session).toBe('abc');
    });

    test('should clear context', async () => {
      logger.setContext({ userId: '123', session: 'abc' });
      logger.clearContext();
      await logger.info('Test message');
      await logger.waitForWrites();
      
      const content = logger.getLogContent();
      const logs = content['app.log'].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.userId).toBeUndefined();
      expect(lastLog.session).toBeUndefined();
    });
  });

  describe('Performance Logging', () => {
    test('should log performance metrics', async () => {
      const operation = 'test-operation';
      const duration = 100;
      
      await logger.logPerformance(operation, duration);
      await logger.waitForWrites();
      
      const content = logger.getLogContent();
      const logs = content['app.log'].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.type).toBe('performance');
      expect(lastLog.operation).toBe(operation);
      expect(lastLog.duration).toBe(duration);
    });
  });
});
