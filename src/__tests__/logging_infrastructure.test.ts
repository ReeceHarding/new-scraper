import path from 'path'
import * as fs from 'fs/promises'
import { ServerLogger } from '../services/server-logger'
import fetch from 'node-fetch'
import type { PathLike } from 'fs'
import type { Stats, Dirent } from 'fs'
import type { FileHandle } from 'fs/promises'

jest.mock('fs/promises')
jest.mock('node-fetch')

const _mockFetch = jest.mocked(fetch)

describe('Logging Infrastructure', () => {
  let logger: ServerLogger
  let logDir: string
  let mockLogContent: { [key: string]: string }
  let _appendFileSpy: jest.SpyInstance
  let _copyFileSpy: jest.SpyInstance
  let _consoleErrorSpy: jest.SpyInstance

  beforeEach(async () => {
    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
    logDir = path.join(process.cwd(), 'test-logs')
    mockLogContent = {}
    
    // Mock fs.stat to return file size
    jest.spyOn(fs, 'stat').mockImplementation(async () => ({
      size: mockLogContent[path.join(logDir, 'error.log')]?.length || 0
    } as any))
    
    _appendFileSpy = jest.spyOn(fs, 'appendFile').mockImplementation(async (filePath: any, data: any) => {
      const path = filePath.toString()
      if (!mockLogContent[path]) {
        mockLogContent[path] = ''
      }
      mockLogContent[path] += data.toString()
      return Promise.resolve()
    })
    
    _copyFileSpy = jest.spyOn(fs, 'copyFile').mockImplementation(async (src: any, dest: any) => {
      const srcPath = src.toString()
      const destPath = dest.toString()
      mockLogContent[destPath] = mockLogContent[srcPath] || ''
      return Promise.resolve()
    })
    
    _consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await logger.setTestMode(false)
  })

  test('can write error logs', async () => {
    const testMessage = 'Test error message'
    const logPath = path.join(logDir, 'error.log')

    await logger.error(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)

    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.level).toBe('error')
  })

  test('handles file system errors gracefully', async () => {
    const _mockError = new Error('File system error')
    logger.pendingWrites.push(Promise.resolve())

    await expect(logger.error('Test error message')).rejects.toThrow()
    expect(_appendFileSpy).not.toHaveBeenCalled()
  })

  test('handles log rotation errors gracefully', async () => {
    const _mockError = new Error('Rotation error')
    mockLogContent[path.join(logDir, 'error.log')] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB
    logger.pendingWrites.push(Promise.resolve())

    await expect(logger.info('Test message')).rejects.toThrow()
    expect(_copyFileSpy).not.toHaveBeenCalled()
  })

  test('log file rotation works when file exceeds size limit', async () => {
    const logPath = path.join(logDir, 'error.log')
    mockLogContent[logPath] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB

    await logger.error('Test message')
    await logger.waitForWrites()

    const rotatedFiles = logger.getRotatedFiles()
    expect(rotatedFiles.length).toBeGreaterThan(0)
  })

  test('alert notifications are triggered', async () => {
    // Generate enough errors to trigger alert
    for (let i = 0; i < 6; i++) {
      await logger.error('Test error message')
    }

    await logger.waitForWrites()
    const logContent = logger.getLogContent()
    const logs = Object.values(logContent)
      .join('\n')
      .split('\n')
      .filter(line => line)
      .map(line => JSON.parse(line))

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

  test('error logs include stack trace', async () => {
    const testError = new Error('Test error')
    const logPath = path.join(logDir, 'error.log')

    await logger.error('Test error occurred', testError)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    
    expect(logEntry.error).toBeDefined()
    expect(logEntry.error.stack).toBeDefined()
  })

  test('log rotation is configured', async () => {
    const logPath = path.join(logDir, 'error.log')
    mockLogContent[logPath] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB

    await logger.error('Test message')
    await logger.waitForWrites()

    const rotatedFiles = logger.getRotatedFiles()
    expect(rotatedFiles.length).toBeGreaterThan(0)
    expect(rotatedFiles[0]).toMatch(/error\.log\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
  })
})

describe('Logging Infrastructure', () => {
  let logger: ServerLogger
  let logDir: string
  let mockLogContent: { [key: string]: string }
  let _consoleErrorSpy: jest.SpyInstance
  let _appendFileSpy: jest.SpyInstance
  let _copyFileSpy: jest.SpyInstance

  const _mockFetch = fetch as jest.MockedFunction<typeof fetch>
  
  beforeEach(async () => {
    logDir = path.join(process.cwd(), 'test-logs')
    mockLogContent = {}
    
    _mockFetch.mockResolvedValue({ 
      ok: true,
      status: 200,
      statusText: 'OK'
    } as any)

    // Mock fs functions
    _appendFileSpy = jest.spyOn(fs, 'appendFile').mockImplementation(async (file: PathLike | FileHandle, data: any) => {
      const filePath = file.toString()
      if (!mockLogContent[filePath]) {
        mockLogContent[filePath] = ''
      }
      mockLogContent[filePath] += data.toString()
      return Promise.resolve()
    })

    _copyFileSpy = jest.spyOn(fs, 'copyFile').mockImplementation(async (src: PathLike | FileHandle, dest: PathLike | FileHandle) => {
      const srcPath = src.toString()
      const destPath = dest.toString()
      if (!mockLogContent[srcPath]) {
        mockLogContent[srcPath] = ''
      }
      mockLogContent[destPath] = mockLogContent[srcPath]
      return Promise.resolve()
    })

    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
    jest.spyOn(fs, 'writeFile').mockImplementation(async (file: any, _data: any) => {
      mockLogContent[file.toString()] = ''
      return Promise.resolve()
    })
    jest.spyOn(fs, 'readFile').mockImplementation(async (_path: any) => {
      return Promise.resolve(mockLogContent[_path.toString()] || '')
    })
    jest.spyOn(fs, 'stat').mockImplementation((filePath: PathLike) => {
      const content = mockLogContent[filePath.toString()] || ''
      return Promise.resolve({
        size: content.length,
        isFile: () => true
      } as Stats)
    })
    jest.spyOn(fs, 'readdir').mockImplementation(async (_path: any, _options?: any) => {
      const files = Object.keys(mockLogContent).filter(file => file.includes('-20'))
      return files.map(file => ({
        name: file,
        isFile: () => true
      } as Dirent))
    }) as jest.SpyInstance<Promise<Dirent[]>>

    _consoleErrorSpy = jest.spyOn(console, 'error')

    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
    logger.clearErrorCount()
    logger.clearContext()
    
    // Initialize with empty content
    const appLogPath = path.join(logDir, 'app.log')
    const errorLogPath = path.join(logDir, 'error.log')
    mockLogContent[appLogPath] = ''
    mockLogContent[errorLogPath] = ''
  }, 10000) // Increase timeout for setup

  afterEach(async () => {
    await logger.waitForWrites()
    mockLogContent = {}
    jest.clearAllMocks()
    await logger.setTestMode(false)
  }, 10000) // Increase timeout for cleanup

  test('logger is properly configured', () => {
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  test('can write info logs', async () => {
    const testMessage = 'Test info message'
    const logPath = path.join(logDir, 'app.log')

    await logger.info(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.level).toBe('info')
  })

  test('logs include timestamp and level', async () => {
    const testMessage = 'Test message'
    const logPath = path.join(logDir, 'app.log')

    await logger.info(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    
    expect(logEntry.timestamp).toBeDefined()
    expect(logEntry.level).toBe('info')
  })

  test('logs include request context when available', async () => {
    const testMessage = 'Test message'
    const reqId = 'test-req-123'
    const logPath = path.join(logDir, 'app.log')

    logger.setContext({ reqId })
    await logger.info(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    
    expect(logEntry.reqId).toBe(reqId)
    logger.clearContext()
  })

  test('error logs include stack trace', async () => {
    const testError = new Error('Test error')
    const logPath = path.join(logDir, 'error.log')

    await logger.error('Test error occurred', testError)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    
    expect(logEntry.error.stack).toBeDefined()
    expect(logEntry.error.message).toBe('Test error')
  })

  test('log rotation is configured', async () => {
    const logger = ServerLogger.getInstance()
    await logger.setTestMode(true)

    // Fill the log file to trigger rotation
    const logPath = path.join(logger.getLogDir(), 'app.log')
    mockLogContent[logPath] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB

    await logger.info('Test message')
    await logger.waitForWrites()

    const rotatedFiles = Object.keys(mockLogContent).filter(file => 
      file.startsWith(logPath.replace('.log', '')) && file !== logPath
    )
    
    expect(rotatedFiles.length).toBeGreaterThan(0)
    expect(rotatedFiles[0]).toMatch(/app-.*\.log$/)
  })

  test('performance monitoring logs are written', async () => {
    const logPath = path.join(logDir, 'app.log')
    const operation = 'test-operation'
    const duration = 100

    await logger.logPerformance(operation, duration)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    
    expect(logEntry).toMatchObject({
      type: 'performance',
      operation,
      duration,
      timestamp: expect.any(String)
    })
  })
})

describe('Performance Monitoring', () => {
  let logger: ServerLogger
  let logDir: string
  let mockLogContent: { [key: string]: string }

  beforeEach(async () => {
    logDir = path.join(process.cwd(), 'test-logs')
    mockLogContent = {}
    logger = ServerLogger.getInstance()

    jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
    jest.spyOn(fs, 'writeFile').mockImplementation(async (file: any, _data: any) => {
      mockLogContent[file.toString()] = ''
      return Promise.resolve()
    })
    jest.spyOn(fs, 'appendFile').mockImplementation(async (path: any, data: any) => {
      mockLogContent[path.toString()] = (mockLogContent[path.toString()] || '') + data.toString()
      return Promise.resolve()
    })
    jest.spyOn(fs, 'stat').mockImplementation(async (path: any) => {
      return Promise.resolve({
        size: (mockLogContent[path.toString()] || '').length,
        isFile: () => true
      } as Stats)
    })

    await logger.setTestMode(true)
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await logger.setTestMode(false)
  })

  test('should log performance metrics', async () => {
    const logPath = path.join(logDir, 'app.log')
    const operation = 'test-operation'
    const duration = 100

    await logger.logPerformance(operation, duration)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])

    expect(logEntry).toMatchObject({
      type: 'performance',
      operation,
      duration,
      timestamp: expect.any(String)
    })
  })
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
    const logPath = path.join(logDir, 'error.log')
    const testError = new Error('Test error')

    // Generate enough errors to trigger alert
    for (let i = 0; i < 6; i++) {
      await logger.error(testError.message, testError)
      await logger.waitForWrites() // Wait after each write
    }

    const logs = mockLogContent[logPath]
      .trim()
      .split('\n')
      .filter(line => line)
      .map(line => JSON.parse(line))

    const alertLog = logs.find(log => log.type === 'alert')
    expect(alertLog).toBeDefined()
    expect(alertLog).toMatchObject({
      type: 'alert',
      level: 'error',
      count: 6,
      window: 60000
    })
  }, 15000) // Increase timeout for multiple writes
}) 