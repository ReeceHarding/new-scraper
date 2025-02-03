import path from 'path'
import { ServerLogger } from '../server-logger'

describe('Advanced Logging Infrastructure', () => {
  let logger: ServerLogger

  beforeAll(async () => {
    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
  })

  beforeEach(async () => {
    await logger.setTestMode(true)
    logger.clearContext()
    logger.clearLogContent()
    logger.clearErrorCount()
    await logger.simulateError(false)
  })

  afterEach(async () => {
    await logger.waitForWrites()
  })

  afterAll(async () => {
    await logger.setTestMode(false)
  })

  describe('Performance Monitoring', () => {
    it('should log performance metrics', async () => {
      const operation = 'test-operation'
      const duration = 150
      const metadata = { userId: '123', requestId: 'abc' }
      
      await logger.logPerformance(operation, duration, metadata)
      await logger.waitForWrites()

      const logContent = logger.getLogContent()
      const logPath = path.join(logger.getLogDir(), 'app.log')
      const lines = logContent[logPath].trim().split('\n').filter(line => line)
      
      expect(lines.length).toBeGreaterThan(0)
      const logEntry = JSON.parse(lines[0])
      expect(logEntry.operation).toBe(operation)
      expect(logEntry.duration).toBe(duration)
      expect(logEntry.userId).toBe(metadata.userId)
      expect(logEntry.requestId).toBe(metadata.requestId)
    })
  })

  describe('Alert Notifications', () => {
    it('should trigger an alert after threshold errors', async () => {
      // Reset error state and set unique test threshold
      logger.clearErrorCount()
      logger.clearLogContent()
      await logger.waitForWrites()

      // Generate unique test errors
      const uniquePrefix = 'unique_test_error_'
      for (let i = 0; i < 4; i++) {
        await logger.error(uniquePrefix + i)
      }
      await logger.waitForWrites()

      // Check no alert yet
      const contentBefore = logger.getLogContent()
      const logPath = path.join(logger.getLogDir(), 'error.log')
      const logsBefore = contentBefore[logPath].trim().split('\n')
        .map(line => JSON.parse(line))
        .filter(log => log.message.startsWith(uniquePrefix))
      const alertLogBefore = logsBefore.find(log => log.type === 'alert')
      expect(alertLogBefore).toBeUndefined()

      // Generate one more error to trigger alert
      await logger.error(uniquePrefix + 'final')
      await logger.waitForWrites()

      // Check alert was triggered
      const contentAfter = logger.getLogContent()
      const logsAfter = contentAfter[logPath].trim().split('\n')
        .map(line => JSON.parse(line))
        .filter(log => log.message.startsWith(uniquePrefix) || log.type === 'alert')
      const alertLogAfter = logsAfter.find(log => log.type === 'alert')
      expect(alertLogAfter).toBeDefined()
      expect(alertLogAfter).toMatchObject({
        type: 'alert',
        level: 'alert',
        message: expect.stringContaining('Error threshold exceeded')
      })
    })
  })

  describe('Context Management', () => {
    it('should include context in logs', async () => {
      const context = { userId: '123', sessionId: 'abc', environment: 'test' }
      logger.setContext(context)
      
      await logger.info('Test message')
      await logger.waitForWrites()

      const logContent = logger.getLogContent()
      const logPath = path.join(logger.getLogDir(), 'app.log')
      const lines = logContent[logPath].trim().split('\n').filter(line => line)
      
      expect(lines.length).toBeGreaterThan(0)
      const logEntry = JSON.parse(lines[0])
      expect(logEntry).toMatchObject(context)
    })

    it('should clear context', async () => {
      const context = { userId: '123', sessionId: 'abc' }
      logger.setContext(context)
      logger.clearContext()
      
      await logger.info('Test message')
      await logger.waitForWrites()

      const logContent = logger.getLogContent()
      const logPath = path.join(logger.getLogDir(), 'app.log')
      const lines = logContent[logPath].trim().split('\n').filter(line => line)
      
      expect(lines.length).toBeGreaterThan(0)
      const logEntry = JSON.parse(lines[0])
      expect(logEntry.userId).toBeUndefined()
      expect(logEntry.sessionId).toBeUndefined()
    })
  })
}) 