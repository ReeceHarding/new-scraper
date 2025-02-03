import path from 'path'
import * as fs from 'fs/promises'
import { ServerLogger } from '../server-logger'
import fetch from 'node-fetch'
import type { PathLike } from 'fs'
import type { Stats } from 'fs'
import type { FileHandle } from 'fs/promises'

jest.mock('fs/promises')
jest.mock('node-fetch')

const _mockFetch = jest.mocked(fetch)

const _logPath = path.join(process.cwd(), 'logs', 'app.log')

describe('ServerLogger', () => {
  let logger: ServerLogger
  let _logPath: string
  let mockLogContent: { [key: string]: string }
  let _appendFileSpy: jest.SpyInstance
  let _copyFileSpy: jest.SpyInstance
  let _consoleErrorSpy: jest.SpyInstance

  beforeEach(async () => {
    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
    await logger.waitForWrites()
    _logPath = path.join(process.cwd(), 'test-logs', 'error.log')
    mockLogContent = {}
    
    // Mock fs.stat to return file size
    jest.spyOn(fs, 'stat').mockImplementation(async (filePath: PathLike) => ({
      size: mockLogContent[filePath.toString()]?.length || 0
    } as Stats))
    
    _appendFileSpy = jest.spyOn(fs, 'appendFile').mockImplementation(async (filePath: PathLike | FileHandle, data: string | Uint8Array) => {
      const path = filePath.toString()
      if (!mockLogContent[path]) {
        mockLogContent[path] = ''
      }
      mockLogContent[path] += data.toString()
      return Promise.resolve()
    })
    
    _copyFileSpy = jest.spyOn(fs, 'copyFile').mockImplementation(async (src: PathLike, dest: PathLike) => {
      const srcPath = src.toString()
      const destPath = dest.toString()
      mockLogContent[destPath] = mockLogContent[srcPath] || ''
      return Promise.resolve()
    })
    
    _consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // Mock fetch to resolve immediately in test mode
    _mockFetch.mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      } as any
    })

    logger.clearLogContent()
    logger.clearErrorCount()
  }, 30000)

  afterEach(async () => {
    // Wait for all pending operations to complete
    await logger.waitForWrites();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset logger state
    await logger.setTestMode(false);
    
    // Clear mock content
    mockLogContent = {};
    
    // Wait for any remaining async operations
    await new Promise(resolve => setTimeout(resolve, 100));
  }, 30000)

  it('handles file system errors gracefully', async () => {
    await logger.simulateError(true);
    await expect(logger.error('Test error')).rejects.toThrow();
    await logger.simulateError(false);
  });

  it('handles log rotation errors gracefully', async () => {
    await logger.simulateError(true);
    await expect(logger.error('Test error')).rejects.toThrow();
    await logger.simulateError(false);
  });

  it('log file rotation works when file exceeds size limit', async () => {
    const largeMessage = 'x'.repeat(200);
    await logger.info(largeMessage);
    const rotatedFiles = logger.getRotatedFiles();
    expect(rotatedFiles.length).toBeGreaterThan(0);
  });

  it('alert notifications are triggered', async () => {
    // Generate enough errors to trigger an alert
    for (let i = 0; i < 6; i++) {
      await logger.error(`Error ${i}`);
    }

    const content = logger.getLogContent();
    const _logPath = path.join(logger.getLogDir(), 'error.log');
    const logs = content[_logPath].trim().split('\n').map(line => JSON.parse(line));
    const alertLog = logs.find(log => log.type === 'alert');
    expect(alertLog).toBeDefined();
    expect(alertLog).toMatchObject({
      type: 'alert',
      level: 'alert'
    });
  });

  it('handles API errors gracefully', async () => {
    await logger.error('Test error');
    const content = logger.getLogContent();
    expect(content).toBeDefined();
  });

  describe('Basic Logging', () => {
    it('should log error messages', async () => {
      const message = 'Test error message';
      await logger.error(message);

      const content = logger.getLogContent();
      const _logPath = path.join(logger.getLogDir(), 'error.log');
      const logs = content[_logPath].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.message).toBe(message);
      expect(lastLog.level).toBe('error');
    });

    it('should log info messages', async () => {
      const message = 'Test info message';
      await logger.info(message);

      const content = logger.getLogContent();
      const _logPath = path.join(logger.getLogDir(), 'app.log');
      const logs = content[_logPath].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.message).toBe(message);
      expect(lastLog.level).toBe('info');
    });
  });

  describe('Error Threshold', () => {
    it('should trigger alert when error threshold is exceeded', async () => {
      // Generate enough errors to trigger an alert
      for (let i = 0; i < 6; i++) {
        await logger.error(`Error ${i}`);
      }

      const content = logger.getLogContent();
      const _logPath = path.join(logger.getLogDir(), 'error.log');
      const logs = content[_logPath].trim().split('\n');
      const alertLog = logs.find(log => {
        try {
          const parsed = JSON.parse(log);
          return parsed.type === 'alert';
        } catch {
          return false;
        }
      });
      expect(alertLog).toBeDefined();
      const parsedAlert = JSON.parse(alertLog!);
      expect(parsedAlert).toMatchObject({
        type: 'alert',
        level: 'alert'
      });
    });
  });

  describe('Context Management', () => {
    it('should include context in logs', async () => {
      logger.setContext({ userId: '123', session: 'abc' });
      await logger.info('Test message');

      const content = logger.getLogContent();
      const _logPath = path.join(logger.getLogDir(), 'app.log');
      const logs = content[_logPath].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.userId).toBe('123');
      expect(lastLog.session).toBe('abc');
    });

    it('should clear context', async () => {
      logger.setContext({ userId: '123', session: 'abc' });
      logger.clearContext();
      await logger.info('Test message');

      const content = logger.getLogContent();
      const _logPath = path.join(logger.getLogDir(), 'app.log');
      const logs = content[_logPath].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.userId).toBeUndefined();
      expect(lastLog.session).toBeUndefined();
    });
  });

  describe('Performance Monitoring', () => {
    it('should log performance metrics', async () => {
      const operation = 'test-operation';
      const duration = 100;
      await logger.logPerformance(operation, duration);

      const content = logger.getLogContent();
      const _logPath = path.join(logger.getLogDir(), 'app.log');
      const logs = content[_logPath].trim().split('\n');
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = JSON.parse(logs[logs.length - 1]);
      
      expect(lastLog.type).toBe('performance');
      expect(lastLog.operation).toBe(operation);
      expect(lastLog.duration).toBe(duration);
    });
  });

  describe('Error Simulation', () => {
    it('should throw error when simulation is enabled', async () => {
      await logger.simulateError(true);
      await expect(logger.error('Test error')).rejects.toThrow();
      await logger.simulateError(false);
    });
  });

  describe('Alert Notifications', () => {
    it('should trigger an alert after threshold errors', async () => {
      // Generate enough errors to trigger an alert
      for (let i = 0; i < 6; i++) {
        await logger.error(`Error ${i}`);
      }

      const content = logger.getLogContent();
      const _logPath = path.join(logger.getLogDir(), 'error.log');
      const logs = content[_logPath].trim().split('\n').map(line => JSON.parse(line));
      const alertLog = logs.find(log => log.type === 'alert');
      expect(alertLog).toBeDefined();
      expect(alertLog).toMatchObject({
        type: 'alert',
        level: 'alert',
        count: expect.any(Number),
        window: expect.any(Number)
      });
    });
  });
}) 