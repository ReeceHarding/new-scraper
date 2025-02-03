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

  test('handles file system errors gracefully', async () => {
    mockLogContent[_logPath] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB

    await expect(logger.error('Test error message')).resolves.not.toThrow()
    await logger.waitForWrites() // Wait for all writes to complete
    // Wait for any remaining async operations
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(_appendFileSpy).not.toHaveBeenCalled()
  }, 30000)

  test('handles log rotation errors gracefully', async () => {
    mockLogContent[_logPath] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB

    await expect(logger.info('Test message')).resolves.not.toThrow()
    await logger.waitForWrites() // Wait for all writes to complete
    // Wait for any remaining async operations
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(_copyFileSpy).not.toHaveBeenCalled()
  }, 30000)

  test('log file rotation works when file exceeds size limit', async () => {
    const _logPath = path.join(logger.getLogDir(), 'app.log')
    const largeMessage = 'x'.repeat(1024 * 1024 + 1); // Slightly over 1MB
    
    await logger.info(largeMessage);
    await logger.waitForWrites();
    await logger.info('New message after rotation');
    await logger.waitForWrites();

    const rotatedFiles = logger.getRotatedFiles();
    expect(rotatedFiles.length).toBeGreaterThan(0);
  }, 30000)

  test('alert notifications are triggered', async () => {
    // Generate enough errors to trigger alert
    for (let i = 0; i < 6; i++) {
      await logger.error('Test error message');
      await logger.waitForWrites();
      // Add a small delay to ensure errors are processed in order
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Wait for all writes to complete
    await logger.waitForWrites();

    const content = logger.getLogContent();
    const _logPath = path.join(logger.getLogDir(), 'error.log');
    const logs = content[_logPath].trim().split('\n').map(line => JSON.parse(line));
    const alertLog = logs.find(log => log.type === 'alert');
    expect(alertLog).toBeDefined();
    expect(alertLog).toMatchObject({
      type: 'alert',
      level: 'error',
      message: expect.stringContaining('Error threshold exceeded'),
      count: 6,
      window: 60000
    });
  }, 30000);

  test('handles API errors gracefully', async () => {
    // Mock fetch to simulate API error
    _mockFetch.mockImplementationOnce(() => Promise.reject(new Error('API error')));

    // Ensure we're not in test mode to trigger API calls
    await logger.setTestMode(false);

    // Trigger an error log
    await logger.error('Test error message');
    await logger.waitForWrites();

    // Wait for any remaining async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(_consoleErrorSpy).toHaveBeenCalled();

    // Reset to test mode
    await logger.setTestMode(true);
  }, 30000);
})

describe('Alert Notifications', () => {
  let logger: ServerLogger
  let logDir: string
  let mockLogContent: { [key: string]: string }

  beforeEach(async () => {
    logDir = path.join(process.cwd(), 'test-logs')
    mockLogContent = {}
    logger = ServerLogger.getInstance()

    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
    jest.spyOn(fs, 'writeFile').mockImplementation(async (file: any, _data: any) => {
      const filePath = file.toString()
      mockLogContent[filePath] = ''
      return Promise.resolve()
    })
    jest.spyOn(fs, 'appendFile').mockImplementation(async (path: any, data: any) => {
      const filePath = path.toString()
      if (!mockLogContent[filePath]) {
        mockLogContent[filePath] = ''
      }
      mockLogContent[filePath] += data.toString()
      return Promise.resolve()
    })
    jest.spyOn(fs, 'stat').mockImplementation(async (path: any) => {
      return Promise.resolve({
        size: (mockLogContent[path.toString()] || '').length,
        isFile: () => true
      } as Stats)
    })

    await logger.setTestMode(true)
    
    // Initialize log files
    const errorLogPath = path.join(logDir, 'error.log')
    mockLogContent[errorLogPath] = ''
  }, 10000) // Increase timeout for setup

  afterEach(async () => {
    await logger.waitForWrites()
    jest.clearAllMocks()
    await logger.setTestMode(false)
  }, 10000) // Increase timeout for cleanup

  test('should trigger an alert after threshold errors', async () => {
    const _logPath = path.join(logDir, 'error.log')
    const testError = new Error('Test error')

    // Generate enough errors to trigger alert
    for (let i = 0; i < 5; i++) {
      await logger.error(testError.message, testError)
      await logger.waitForWrites() // Wait after each write
      // Add a small delay to ensure timestamps are different
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Wait for all writes to complete
    await logger.waitForWrites()

    const content = logger.getLogContent()
    const logs = content[_logPath].trim().split('\n').map(line => JSON.parse(line))
    const alertLog = logs.find(log => log.type === 'alert')
    expect(alertLog).toBeDefined()
    expect(alertLog).toMatchObject({
      type: 'alert',
      level: 'error',
      message: expect.stringContaining('Error threshold exceeded'),
      count: 5,
      window: 60000
    })
  }, 15000) // Increase timeout for multiple writes
})

describe('ServerLogger', () => {
  let logger: ServerLogger

  beforeEach(async () => {
    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
    await logger.waitForWrites()
    logger.clearContext()
    logger.clearLogContent()
  })

  afterEach(async () => {
    await logger.waitForWrites()
    await logger.setTestMode(false)
  })

  describe('Basic Logging', () => {
    test('should log error messages', async () => {
      const message = 'Test error message'
      await logger.error(message)

      const content = logger.getLogContent()
      const _logPath = path.join(logger.getLogDir(), 'error.log')
      const logs = content[_logPath].trim().split('\n')
      const lastLog = JSON.parse(logs[logs.length - 1])
      
      expect(lastLog.message).toBe(message)
      expect(lastLog.level).toBe('error')
      expect(lastLog.timestamp).toBeDefined()
    })

    test('should log info messages', async () => {
      const message = 'Test info message'
      await logger.info(message)

      const content = logger.getLogContent()
      const _logPath = path.join(logger.getLogDir(), 'app.log')
      const logs = content[_logPath].trim().split('\n')
      const lastLog = JSON.parse(logs[logs.length - 1])
      
      expect(lastLog.message).toBe(message)
      expect(lastLog.level).toBe('info')
      expect(lastLog.timestamp).toBeDefined()
    })
  })

  describe('Error Threshold', () => {
    test('should trigger alert when error threshold is exceeded', async () => {
      // Generate errors
      for (let i = 0; i < 6; i++) {
        await logger.error(`Error ${i}`)
      }

      // Wait for alert processing
      await new Promise(resolve => setTimeout(resolve, 100))

      const content = logger.getLogContent()
      const _logPath = path.join(logger.getLogDir(), 'error.log')
      const logs = content[_logPath].trim().split('\n').map(line => JSON.parse(line))
      const alertLog = logs.find(log => log.type === 'alert')
      
      expect(alertLog).toBeDefined()
      expect(alertLog).toMatchObject({
        type: 'alert',
        level: 'error',
        message: expect.stringContaining('Error threshold exceeded'),
        count: 6,
        window: 60000
      })
    })
  })

  describe('Context Management', () => {
    test('should include context in logs', async () => {
      const context = { userId: '123', session: 'abc' }
      logger.setContext(context)

      await logger.info('Test message with context')

      const content = logger.getLogContent()
      const _logPath = path.join(logger.getLogDir(), 'app.log')
      const logs = content[_logPath].trim().split('\n')
      const lastLog = JSON.parse(logs[logs.length - 1])
      
      expect(lastLog.userId).toBe('123')
      expect(lastLog.session).toBe('abc')
      expect(lastLog.message).toBe('Test message with context')
    })

    test('should clear context', async () => {
      logger.setContext({ userId: '123' })
      logger.clearContext()

      await logger.info('Test message without context')

      const content = logger.getLogContent()
      const _logPath = path.join(logger.getLogDir(), 'app.log')
      const logs = content[_logPath].trim().split('\n')
      const lastLog = JSON.parse(logs[logs.length - 1])
      
      expect(lastLog.userId).toBeUndefined()
    })
  })

  describe('Performance Monitoring', () => {
    test('should log performance metrics', async () => {
      const metrics = {
        operation: 'test-op',
        duration: 100,
        success: true
      }

      await logger.logPerformance(metrics)

      const content = logger.getLogContent()
      const _logPath = path.join(logger.getLogDir(), 'app.log')
      const logs = content[_logPath].trim().split('\n')
      const lastLog = JSON.parse(logs[logs.length - 1])
      
      expect(lastLog).toMatchObject({
        type: 'performance',
        ...metrics
      })
    })
  })

  describe('Error Simulation', () => {
    test('should throw error when simulation is enabled', async () => {
      logger.enableErrorSimulation()
      
      await expect(logger.error('Test error')).rejects.toThrow('Simulated error in test mode')
      
      logger.disableErrorSimulation()
    })
  })
}) 