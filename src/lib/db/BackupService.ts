import { supabase } from '@/lib/supabase'
import { logger } from '@/services/logging'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join, isAbsolute } from 'path'
import { existsSync, mkdirSync } from 'fs'

const execAsync = promisify(exec)

export class BackupService {
  private static instance: BackupService
  private backupDir: string

  private constructor() {
    // Use absolute path for backups directory
    const rootDir = process.cwd()
    this.backupDir = join(rootDir, 'backups')
    
    // Create backups directory if it doesn't exist
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true })
      logger.info('Created backups directory', { dir: this.backupDir })
    }
  }

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService()
    }
    return BackupService.instance
  }

  private getBackupFileName(): string {
    const date = new Date()
    const timestamp = date.toISOString().replace(/[:.]/g, '-')
    return `backup-${timestamp}.sql`
  }

  private escapeShellArg(arg: string): string {
    return `"${arg.replace(/"/g, '\\"')}"`
  }

  private resolvePath(backupFile: string): string {
    return isAbsolute(backupFile) ? backupFile : join(this.backupDir, backupFile)
  }

  async createBackup(): Promise<string> {
    try {
      const backupFile = this.getBackupFileName()
      const fullPath = this.resolvePath(backupFile)
      logger.info('Creating database backup', { file: fullPath })

      // Get database connection info from environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
      }

      // Extract host and port from Supabase URL
      const url = new URL(supabaseUrl)
      const { host, port, database, user, password } = {
        host: url.hostname,
        port: url.port || '5432',
        database: 'postgres',
        user: 'postgres',
        password: process.env.SUPABASE_DB_PASSWORD || ''
      }

      if (!password) {
        throw new Error('SUPABASE_DB_PASSWORD is not set')
      }

      // Create backup using pg_dump with properly escaped arguments
      const command = [
        `PGPASSWORD=${this.escapeShellArg(password)}`,
        'pg_dump',
        `-h ${this.escapeShellArg(host)}`,
        `-p ${port}`,
        `-U ${this.escapeShellArg(user)}`,
        `-d ${this.escapeShellArg(database)}`,
        '-F p',
        `-f ${this.escapeShellArg(fullPath)}`
      ].join(' ')

      await execAsync(command)

      logger.info('Database backup created successfully', { file: fullPath })
      return backupFile
    } catch (error) {
      logger.error('Failed to create database backup:', error)
      throw error
    }
  }

  async restoreBackup(backupFile: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(backupFile)
      if (!existsSync(fullPath)) {
        throw new Error(`Backup file not found: ${fullPath}`)
      }

      logger.info('Restoring database from backup', { file: backupFile })

      // Get database connection info from environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      if (!supabaseUrl) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
      }

      // Extract host and port from Supabase URL
      const url = new URL(supabaseUrl)
      const { host, port, database, user, password } = {
        host: url.hostname,
        port: url.port || '5432',
        database: 'postgres',
        user: 'postgres',
        password: process.env.SUPABASE_DB_PASSWORD || ''
      }

      if (!password) {
        throw new Error('SUPABASE_DB_PASSWORD is not set')
      }

      // Drop all existing connections using psql with properly escaped arguments
      const dropConnectionsCommand = [
        `PGPASSWORD=${this.escapeShellArg(password)}`,
        'psql',
        `-h ${this.escapeShellArg(host)}`,
        `-p ${port}`,
        `-U ${this.escapeShellArg(user)}`,
        `-d ${this.escapeShellArg(database)}`,
        '-c',
        this.escapeShellArg(
          `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${database}' AND pid <> pg_backend_pid();`
        )
      ].join(' ')

      await execAsync(dropConnectionsCommand)

      // Restore backup using psql with properly escaped arguments
      const restoreCommand = [
        `PGPASSWORD=${this.escapeShellArg(password)}`,
        'psql',
        `-h ${this.escapeShellArg(host)}`,
        `-p ${port}`,
        `-U ${this.escapeShellArg(user)}`,
        `-d ${this.escapeShellArg(database)}`,
        `-f ${this.escapeShellArg(fullPath)}`
      ].join(' ')

      await execAsync(restoreCommand)

      logger.info('Database restored successfully', { file: backupFile })
    } catch (error) {
      logger.error('Failed to restore database:', error)
      throw error
    }
  }

  async listBackups(): Promise<string[]> {
    try {
      logger.info('Listing available backups')
      const { stdout } = await execAsync(`ls -1 ${this.escapeShellArg(this.backupDir)}`)
      const backups = stdout.trim().split('\n').filter(Boolean)
      return backups
    } catch (error) {
      logger.error('Failed to list backups:', error)
      throw error
    }
  }

  async deleteBackup(backupFile: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(backupFile)
      if (!existsSync(fullPath)) {
        throw new Error(`Backup file not found: ${fullPath}`)
      }

      logger.info('Deleting backup file', { file: backupFile })
      await execAsync(`rm ${this.escapeShellArg(fullPath)}`)
      logger.info('Backup file deleted successfully', { file: backupFile })
    } catch (error) {
      logger.error('Failed to delete backup:', error)
      throw error
    }
  }

  async cleanupOldBackups(retentionDays: number = 30): Promise<void> {
    try {
      logger.info('Cleaning up old backups', { retentionDays })
      const command = `find ${this.escapeShellArg(this.backupDir)} -name "backup-*.sql" -type f -mtime +${retentionDays} -delete`
      await execAsync(command)
      logger.info('Old backups cleaned up successfully')
    } catch (error) {
      logger.error('Failed to clean up old backups:', error)
      throw error
    }
  }
} 