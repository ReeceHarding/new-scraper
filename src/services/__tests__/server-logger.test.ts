import path from 'path'
import * as fs from 'fs/promises'
import { ServerLogger } from '../../services/server-logger'
import fetch from 'node-fetch'
import type { PathLike } from 'fs'
import type { Stats } from 'fs'
import type { FileHandle } from 'fs/promises'

jest.mock('fs/promises')
jest.mock('node-fetch')

const _mockFetch = jest.mocked(fetch)

describe('ServerLogger', () => {
  let logger: ServerLogger
  let logPath: string
  let mockLogContent: { [key: string]: string }
  let _appendFileSpy: jest.SpyInstance
  let _copyFileSpy: jest.SpyInstance
  let _consoleErrorSpy: jest.SpyInstance

  beforeEach(async () => {
    logger = ServerLogger.getInstance()
    await logger.setTestMode(true)
    logPath = path.join(process.cwd(), 'test-logs', 'error.log')
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
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await logger.setTestMode(false)
  })

  test('handles file system errors gracefully', async () => {
    mockLogContent[logPath] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB

    await expect(logger.error('Test error message')).resolves.not.toThrow()
    expect(_appendFileSpy).not.toHaveBeenCalled()
  })

  test('handles log rotation errors gracefully', async () => {
    mockLogContent[logPath] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB

    await expect(logger.info('Test message')).resolves.not.toThrow()
    expect(_copyFileSpy).not.toHaveBeenCalled()
  })

  test('log file rotation works when file exceeds size limit', async () => {
    mockLogContent[logPath] = 'x'.repeat(1024 * 1024 + 1) // Slightly over 1MB
    const logEntry = {
      timestamp: expect.any(String),
      level: 'info',
      type: 'log',
      message: 'Test message'
    }

    await logger.info('Test message')
    await logger.waitForWrites()

    const rotatedFiles = logger.getRotatedFiles()
    expect(rotatedFiles.length).toBeGreaterThan(0)
    expect(mockLogContent[logPath]).toBe(JSON.stringify(logEntry) + '\n')
  })

  test('alert notifications are triggered', async () => {
    // Generate enough errors to trigger alert
    for (let i = 0; i < 6; i++) {
      await logger.error('Test error message')
      await logger.waitForWrites()
    }

    const logs = Object.values(mockLogContent)
      .join('\n')
      .split('\n')
      .filter(line => line)
      .map(line => JSON.parse(line))

    const alertLog = logs.find((log: any) => log.type === 'alert')
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