import { jest } from '@jest/globals'
import * as childProcess from 'child_process'
import { promisify } from 'util'
import { PathLike } from 'fs'

jest.mock('child_process', () => ({
  exec: jest.fn()
}))

const exec = promisify(childProcess.exec)

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
  chmodSync: jest.fn()
}))

jest.mock('../../../src/services/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}))

import { BackupService } from '../../../src/lib/db/BackupService'
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync, chmodSync } from 'fs'
import { join } from 'path'
import { logger } from '../../../src/services/logging'
import type { Mock } from 'jest-mock'

// Store original env values
const originalEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD
}

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_DB_PASSWORD = 'test-password'

// Set timeout for all tests
jest.setTimeout(30000) // 30 seconds

describe('BackupService', () => {
  let backupService: BackupService
  const testBackupDir = join(process.cwd(), 'backups')
  const testBackupFile = 'test-backup.sql'
  const testBackupPath = join(testBackupDir, testBackupFile)

  beforeAll(() => {
    // Mock existsSync to return true for backup directory and test file
    jest.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString() === testBackupDir || path.toString() === testBackupPath
    })

    // Mock mkdirSync to do nothing
    jest.mocked(mkdirSync).mockImplementation(() => undefined)

    // Mock exec with proper command handling
    const mockExecCallback = (cmd: string, opts: any, cb: any) => {
      if (typeof opts === 'function') {
        cb = opts
        opts = {}
      }

      // Simulate successful command execution
      if (cmd.includes('pg_dump')) {
        process.nextTick(() => cb(null, { stdout: '', stderr: '' }))
      } else if (cmd.includes('psql')) {
        process.nextTick(() => cb(null, { stdout: '', stderr: '' }))
      } else if (cmd.includes('ls -1')) {
        process.nextTick(() => cb(null, { stdout: 'backup1.sql\nbackup2.sql\n', stderr: '' }))
      } else if (cmd.includes('rm')) {
        process.nextTick(() => cb(null, { stdout: '', stderr: '' }))
      } else if (cmd.includes('find')) {
        process.nextTick(() => cb(null, { stdout: '', stderr: '' }))
      } else {
        process.nextTick(() => cb(null, { stdout: '', stderr: '' }))
      }
      return undefined as any
    }

    // Mock exec to prevent actual command execution
    jest.spyOn(childProcess, 'exec').mockImplementation(mockExecCallback)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    backupService = BackupService.getInstance()
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_DB_PASSWORD = originalEnv.SUPABASE_DB_PASSWORD
    jest.restoreAllMocks()
  })

  describe('createBackup', () => {
    it('should create a backup successfully', async () => {
      const result = await backupService.createBackup()
      expect(result).toMatch(/backup-.*\.sql/)
      expect(childProcess.exec).toHaveBeenCalledWith(
        expect.stringContaining('pg_dump'),
        expect.any(Object),
        expect.any(Function)
      )
    })

    it('should handle backup creation failure', async () => {
      const errorMessage = 'pg_dump: error: could not translate host name "test.supabase.co" to address: nodename nor servname provided, or not known'
      jest.spyOn(childProcess, 'exec').mockImplementationOnce((cmd: string, opts: any, cb: any) => {
        if (typeof opts === 'function') {
          cb = opts
          opts = {}
        }
        const error = new Error(errorMessage)
        error.message = errorMessage
        process.nextTick(() => cb(error, { stdout: '', stderr: errorMessage }))
        return undefined as any
      })

      await expect(backupService.createBackup()).rejects.toThrow(errorMessage)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create database backup:',
        expect.any(Error)
      )
    })
  })

  describe('restoreBackup', () => {
    it('should restore a backup successfully', async () => {
      await backupService.restoreBackup(testBackupFile)
      expect(childProcess.exec).toHaveBeenCalledWith(
        expect.stringContaining('psql'),
        expect.any(Object),
        expect.any(Function)
      )
    })

    it('should handle restore errors', async () => {
      const errorMessage = 'psql: error: could not translate host name "test.supabase.co" to address: nodename nor servname provided, or not known'
      jest.spyOn(childProcess, 'exec').mockImplementationOnce((cmd: string, opts: any, cb: any) => {
        if (typeof opts === 'function') {
          cb = opts
          opts = {}
        }
        const error = new Error(errorMessage)
        error.message = errorMessage
        process.nextTick(() => cb(error, { stdout: '', stderr: errorMessage }))
        return undefined as any
      })

      await expect(backupService.restoreBackup(testBackupFile)).rejects.toThrow(errorMessage)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to restore database:',
        expect.any(Error)
      )
    })
  })

  describe('listBackups', () => {
    it('should list available backups', async () => {
      const result = await backupService.listBackups()
      expect(result).toEqual(['backup1.sql', 'backup2.sql'])
      expect(childProcess.exec).toHaveBeenCalledWith(
        expect.stringContaining('ls -1'),
        expect.any(Object),
        expect.any(Function)
      )
    })

    it('should handle empty backup directory', async () => {
      jest.spyOn(childProcess, 'exec').mockImplementationOnce((cmd: string, opts: any, cb: any) => {
        if (typeof opts === 'function') {
          cb = opts
          opts = {}
        }
        process.nextTick(() => cb(null, { stdout: '', stderr: '' }))
        return undefined as any
      })

      const result = await backupService.listBackups()
      expect(result).toEqual([])
    })

    it('should handle list errors', async () => {
      const errorMessage = 'ls: /Users/reeceharding/Gauntlet/New Scrapin\'/backups: No such file or directory'
      jest.spyOn(childProcess, 'exec').mockImplementationOnce((cmd: string, opts: any, cb: any) => {
        if (typeof opts === 'function') {
          cb = opts
          opts = {}
        }
        const error = new Error(errorMessage)
        error.message = errorMessage
        process.nextTick(() => cb(error, { stdout: '', stderr: errorMessage }))
        return undefined as any
      })

      await expect(backupService.listBackups()).rejects.toThrow(errorMessage)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to list backups:',
        expect.any(Error)
      )
    })
  })

  describe('deleteBackup', () => {
    it('should delete a backup successfully', async () => {
      await backupService.deleteBackup(testBackupFile)
      expect(childProcess.exec).toHaveBeenCalledWith(
        expect.stringContaining('rm'),
        expect.any(Object),
        expect.any(Function)
      )
    })

    it('should handle delete errors', async () => {
      const errorMessage = 'rm: /Users/reeceharding/Gauntlet/New Scrapin\'/backups/test-backup.sql: No such file or directory'
      jest.spyOn(childProcess, 'exec').mockImplementationOnce((cmd: string, opts: any, cb: any) => {
        if (typeof opts === 'function') {
          cb = opts
          opts = {}
        }
        const error = new Error(errorMessage)
        error.message = errorMessage
        process.nextTick(() => cb(error, { stdout: '', stderr: errorMessage }))
        return undefined as any
      })

      await expect(backupService.deleteBackup(testBackupFile)).rejects.toThrow(errorMessage)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete backup:',
        expect.any(Error)
      )
    })
  })

  describe('cleanupOldBackups', () => {
    it('should clean up old backups successfully', async () => {
      await backupService.cleanupOldBackups()
      expect(childProcess.exec).toHaveBeenCalledWith(
        expect.stringContaining('find'),
        expect.any(Object),
        expect.any(Function)
      )
    })

    it('should handle cleanup errors', async () => {
      const errorMessage = 'find: /Users/reeceharding/Gauntlet/New Scrapin\'/backups: No such file or directory'
      jest.spyOn(childProcess, 'exec').mockImplementationOnce((cmd: string, opts: any, cb: any) => {
        if (typeof opts === 'function') {
          cb = opts
          opts = {}
        }
        const error = new Error(errorMessage)
        error.message = errorMessage
        process.nextTick(() => cb(error, { stdout: '', stderr: errorMessage }))
        return undefined as any
      })

      await expect(backupService.cleanupOldBackups()).rejects.toThrow(errorMessage)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to clean up old backups:',
        expect.any(Error)
      )
    })
  })
}) 