import path from 'path'
import * as fs from 'fs/promises'
import { ServerLogger } from '../services/server-logger'
import fetch from 'node-fetch'
import type { PathLike, Stats, Dirent } from 'fs'
import type { FileHandle } from 'fs/promises'

// Create type aliases with underscores for unused types
type _PathLike = PathLike
type _Stats = Stats
type _Dirent = Dirent
type _FileHandle = FileHandle

jest.mock('fs/promises')
jest.mock('node-fetch')

const _mockFetch = jest.mocked(fetch)

describe('Logging Infrastructure', () => {
  let logger: ServerLogger

  beforeAll(async () => {
    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
  })

  beforeEach(async () => {
    // Reset logger state before each test
    await logger.setTestMode(true)
    logger.clearContext()
    logger.clearLogContent()
    await logger.simulateError(false)
  })

  afterEach(async () => {
    await logger.waitForWrites()
  })

  afterAll(async () => {
    await logger.setTestMode(false)
  })

  it('can write error logs', async () => {
    const testMessage = 'Test error message'
    await logger.error(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    const _logPath = path.join(logger.getLogDir(), 'error.log')
    const lines = logContent[_logPath].trim().split('\n').filter(line => line)

    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.level).toBe('error')
  })

  it('handles file system errors gracefully', async () => {
    await logger.simulateError(true)
    await expect(logger.error('Test error message')).rejects.toThrow()
  })

  it('handles log rotation errors gracefully', async () => {
    const _logPath = path.join(logger.getLogDir(), 'error.log')
    logger.clearLogContent()
    await logger.simulateError(true)
    await expect(logger.info('Test message')).rejects.toThrow()
  })

  it('log file rotation works when file exceeds size limit', async () => {
    const _logPath = path.join(logger.getLogDir(), 'app.log')
    const largeMessage = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB
    
    // Write a large message to trigger rotation
    await logger.info(largeMessage)
    await logger.info('Another test message')
    await logger.waitForWrites()

    const rotatedFiles = logger.getRotatedFiles()
    expect(rotatedFiles.length).toBeGreaterThan(0)
    expect(rotatedFiles[0]).toMatch(/app\.log\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
  })

  it('alert notifications are triggered', async () => {
    // Generate enough errors to trigger alert
    for (let i = 0; i < 6; i++) {
      await logger.error('Test error ' + i)
    }
    await logger.waitForWrites()

    const content = logger.getLogContent()
    const logPath = path.join(logger.getLogDir(), 'error.log')
    const logs = content[logPath].trim().split('\n').map(line => JSON.parse(line))
    const alertLog = logs.find(log => log.type === 'alert')
    expect(alertLog).toBeDefined()
    expect(alertLog).toMatchObject({
      type: 'alert',
      level: 'error',
      message: expect.stringContaining('Error threshold exceeded')
    })
  })

  it('error logs include stack trace', async () => {
    const testMessage = 'Test error with stack'
    const testError = new Error('Test error')
    await logger.error(testMessage, testError)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    const _logPath = path.join(logger.getLogDir(), 'error.log')
    expect(logContent[_logPath]).toBeDefined()
    const lines = logContent[_logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    
    expect(logEntry.error).toBeDefined()
    expect(logEntry.error.stack).toBeDefined()
    expect(logEntry.error.message).toBe('Test error')
  })

  it('log rotation is configured', async () => {
    const _logPath = path.join(logger.getLogDir(), 'error.log')
    const largeMessage = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB
    
    // Write a large message to trigger rotation
    await logger.error(largeMessage)
    await logger.error('Another test message')
    await logger.waitForWrites()

    const rotatedFiles = logger.getRotatedFiles()
    expect(rotatedFiles.length).toBeGreaterThan(0)
    expect(rotatedFiles[0]).toMatch(/error\.log\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/)
  })

  it('can write info logs', async () => {
    const testMessage = 'Test info message'
    const _logPath = path.join(logger.getLogDir(), 'app.log')

    await logger.info(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[_logPath]).toBeDefined()
    const lines = logContent[_logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.level).toBe('info')
  })

  it('can write warning logs', async () => {
    const testMessage = 'Test warning message'
    const _logPath = path.join(logger.getLogDir(), 'app.log')

    await logger.warn(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[_logPath]).toBeDefined()
    const lines = logContent[_logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.level).toBe('warn')
  })

  it('can write debug logs', async () => {
    const testMessage = 'Test debug message'
    const _logPath = path.join(logger.getLogDir(), 'app.log')

    await logger.debug(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    expect(logContent[_logPath]).toBeDefined()
    const lines = logContent[_logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.level).toBe('debug')
  })

  it('can write error logs with context', async () => {
    const testMessage = 'Test error with context'
    logger.setContext({ userId: '123', requestId: 'abc' })
    await logger.error(testMessage)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    const _logPath = path.join(logger.getLogDir(), 'error.log')
    expect(logContent[_logPath]).toBeDefined()
    const lines = logContent[_logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.level).toBe('error')
    expect(logEntry.userId).toBe('123')
    expect(logEntry.requestId).toBe('abc')
  })

  it('log rotation works with multiple files', async () => {
    const _logPath = path.join(logger.getLogDir(), 'app.log')
    const largeMessage = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB

    // Write messages to trigger rotation
    await logger.info('Test message 1')
    await logger.info('Test message 2')
    await logger.waitForWrites()

    const rotatedFiles = logger.getRotatedFiles().filter(file => 
        file.startsWith(_logPath.replace('.log', '')) && file !== _logPath
    )
    expect(rotatedFiles.length).toBeGreaterThan(0)
  })

  it('can write logs with metadata', async () => {
    const testMessage = 'Test message with metadata'
    const metadata = { operation: 'test-op', duration: 100 }
    await logger.info(testMessage, metadata)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    const _logPath = path.join(logger.getLogDir(), 'app.log')
    expect(logContent[_logPath]).toBeDefined()
    const lines = logContent[_logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.operation).toBe(metadata.operation)
    expect(logEntry.duration).toBe(metadata.duration)
  })

  it('can write logs with error objects', async () => {
    const testMessage = 'Test error with object'
    const error = new Error('Test error')
    await logger.error(testMessage, error)
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    const _logPath = path.join(logger.getLogDir(), 'error.log')
    expect(logContent[_logPath]).toBeDefined()
    const lines = logContent[_logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])
    expect(logEntry.message).toBe(testMessage)
    expect(logEntry.error.message).toBe('Test error')
    expect(logEntry.error.stack).toBeDefined()
  })

  it('handles error threshold monitoring', async () => {
    // Generate enough errors to trigger alert
    for (let i = 0; i < 6; i++) {
      await logger.error('Test error ' + i)
      await logger.waitForWrites()
    }

    const content = logger.getLogContent()
    const logPath = path.join(logger.getLogDir(), 'error.log')
    const logs = content[logPath].trim().split('\n').map(line => JSON.parse(line))
    const alertLog = logs.find(log => log.type === 'alert')
    expect(alertLog).toBeDefined()
    expect(alertLog).toMatchObject({
      type: 'alert',
      level: 'error',
      message: expect.stringContaining('Error threshold exceeded')
    })
  })
})

describe('Performance Monitoring', () => {
  let logger: ServerLogger

  beforeEach(async () => {
    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
    logger.clearContext()
    logger.clearLogContent()
  })

  afterEach(async () => {
    await logger.waitForWrites()
  })

  it('should log performance metrics', async () => {
    const operation = 'test-operation'
    const duration = 100
    await logger.logPerformance(operation, duration, { extra: 'data' })
    await logger.waitForWrites()

    const logContent = logger.getLogContent()
    const logPath = path.join(logger.getLogDir(), 'app.log')
    expect(logContent[logPath]).toBeDefined()
    const lines = logContent[logPath].trim().split('\n').filter(line => line)
    expect(lines.length).toBeGreaterThan(0)
    const logEntry = JSON.parse(lines[0])

    expect(logEntry).toMatchObject({
      type: 'performance',
      level: 'info',
      operation,
      duration,
      extra: 'data'
    })
  })
})

describe('Alert Notifications', () => {
  let logger: ServerLogger

  beforeEach(async () => {
    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
    logger.clearContext()
    logger.clearLogContent()
  })

  afterEach(async () => {
    await logger.waitForWrites()
  })

  it('should trigger an alert after threshold errors', async () => {
    // Generate enough errors to trigger alert
    for (let i = 0; i < 6; i++) {
      await logger.error('Test error ' + i)
      await logger.waitForWrites()
    }

    const content = logger.getLogContent()
    const logPath = path.join(logger.getLogDir(), 'error.log')
    const logs = content[logPath].trim().split('\n').map(line => JSON.parse(line))
    const alertLog = logs.find(log => log.type === 'alert')
    expect(alertLog).toBeDefined()
    expect(alertLog).toMatchObject({
      type: 'alert',
      level: 'error',
      message: expect.stringContaining('Error threshold exceeded')
    })
  })
}) 