import { SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'
import { logger } from '@/services/logging'

interface MigrationResult {
  success: boolean
  migrationsRun: number
  error?: Error
}

export class MigrationManager {
  private readonly migrationsDir: string
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
    this.migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  }

  async validateMigrationStructure(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.migrationsDir)
      return stats.isDirectory()
    } catch (error) {
      logger.error('Failed to validate migration structure:', { error })
      return false
    }
  }

  async listMigrations(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.migrationsDir)
      return files
        .filter(file => file.endsWith('.sql'))
        .sort((a, b) => {
          const versionA = this.extractVersion(a)
          const versionB = this.extractVersion(b)
          return versionA.localeCompare(versionB)
        })
    } catch (error) {
      logger.error('Failed to list migrations:', { error })
      return []
    }
  }

  async getCurrentVersion(): Promise<string> {
    try {
      await this.ensureVersionTable()

      const { data, error } = await this.client
        .from('schema_versions')
        .select('version')
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error

      return data?.version || '0'
    } catch (error) {
      logger.error('Failed to get current version:', { error })
      return '0'
    }
  }

  async ensureVersionTable(): Promise<boolean> {
    try {
      const { error } = await this.client.rpc('create_schema_versions_if_not_exists')
      
      if (error) {
        // If RPC doesn't exist, create table directly
        await this.client.query(`
          CREATE TABLE IF NOT EXISTS public.schema_versions (
            version TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            checksum TEXT NOT NULL,
            execution_time INTEGER NOT NULL
          );
        `)
      }

      return true
    } catch (error) {
      logger.error('Failed to ensure version table:', { error })
      return false
    }
  }

  async recordMigration(version: string, name: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('schema_versions')
        .insert({
          version,
          name,
          checksum: await this.calculateChecksum(version),
          execution_time: 0
        })

      if (error) throw error
    } catch (error) {
      logger.error('Failed to record migration:', { version, name, error })
      throw error
    }
  }

  async runPendingMigrations(): Promise<MigrationResult> {
    try {
      const currentVersion = await this.getCurrentVersion()
      const migrations = await this.listMigrations()
      let migrationsRun = 0

      for (const migration of migrations) {
        const version = this.extractVersion(migration)
        if (version <= currentVersion) continue

        const sql = await fs.readFile(
          path.join(this.migrationsDir, migration),
          'utf-8'
        )

        const startTime = Date.now()
        const { error } = await this.client.query(sql)
        const executionTime = Date.now() - startTime

        if (error) {
          throw new Error(`Migration ${migration} failed: ${error.message}`)
        }

        await this.recordMigration(version, migration)
        migrationsRun++

        logger.info('Successfully applied migration:', {
          version,
          name: migration,
          executionTime
        })
      }

      return { success: true, migrationsRun }
    } catch (error) {
      logger.error('Migration failed:', { error })
      return {
        success: false,
        migrationsRun: 0,
        error: error instanceof Error ? error : new Error('Unknown error')
      }
    }
  }

  async createMigration(name: string, sql: string): Promise<void> {
    const version = this.generateVersion()
    const filename = `${version}_${name}.sql`
    const filepath = path.join(this.migrationsDir, filename)

    try {
      await fs.writeFile(filepath, sql, 'utf-8')
      logger.info('Created new migration:', { version, name })
    } catch (error) {
      logger.error('Failed to create migration:', { version, name, error })
      throw error
    }
  }

  private generateVersion(): string {
    const now = new Date()
    return now.toISOString().slice(0, 10).replace(/-/g, '')
  }

  private extractVersion(filename: string): string {
    const match = filename.match(/^(\d{8})/)
    return match ? match[1] : '0'
  }

  private async calculateChecksum(version: string): Promise<string> {
    try {
      const migrations = await this.listMigrations()
      const migration = migrations.find(m => m.startsWith(version))
      if (!migration) throw new Error(`Migration ${version} not found`)

      const content = await fs.readFile(
        path.join(this.migrationsDir, migration),
        'utf-8'
      )

      const crypto = await import('crypto')
      return crypto
        .createHash('sha256')
        .update(content)
        .digest('hex')
    } catch (error) {
      logger.error('Failed to calculate checksum:', { version, error })
      throw error
    }
  }
} 