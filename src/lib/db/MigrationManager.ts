import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { logger } from '../../services/logging'

dotenv.config()

const MIGRATIONS_DIR = path.join(__dirname, '../../../migrations')

interface SchemaMigration {
  version: string
  name: string
  applied_at: string
}

export class MigrationManager {
  private supabase: any

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
  }

  async getCurrentVersion(): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('schema_versions')
        .select('version')
        .order('applied_at', { ascending: false })
        .limit(1)
        .single()

      if (error) throw error
      return data?.version || '0'
    } catch (error) {
      logger.error('Failed to get current version:', error)
      throw error
    }
  }

  async getMigrationFiles(): Promise<string[]> {
    try {
      const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort()
      return files
    } catch (error) {
      logger.error('Failed to get migration files:', error)
      throw error
    }
  }

  async runMigration(filename: string): Promise<void> {
    try {
      const filePath = path.join(MIGRATIONS_DIR, filename)
      const sql = fs.readFileSync(filePath, 'utf8')

      // Split SQL into individual statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      // Run each statement
      for (const statement of statements) {
        const { error } = await this.supabase.rpc('run_sql', {
          sql_query: statement
        })

        if (error) {
          throw new Error(`Migration ${filename} failed: ${error.message}`)
        }
      }

      // Update schema_migrations table
      const version = filename.split('_')[0]
      const migration: SchemaMigration = {
        version,
        name: filename,
        applied_at: new Date().toISOString()
      }

      const { error } = await this.supabase
        .from('schema_versions')
        .insert([migration])

      if (error) {
        throw error
      }

      logger.info(`Successfully ran migration: ${filename}`)
    } catch (error) {
      logger.error(`Failed to run migration: ${filename}`, { error })
      throw error
    }
  }

  async migrate(): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion()
      const files = await this.getMigrationFiles()

      for (const file of files) {
        const version = file.split('_')[0]
        if (version > currentVersion) {
          logger.info(`Running migration: ${file}`)
          await this.runMigration(file)
        }
      }
    } catch (error) {
      logger.error('Migration failed', { error })
      throw error
    }
  }

  async createMigration(name: string): Promise<string> {
    try {
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const filename = `${date}_${name}.sql`
      const filePath = path.join(MIGRATIONS_DIR, filename)

      const template = `-- Migration: ${name}
-- Created at: ${new Date().toISOString()}

-- UP

-- DOWN
`;

      fs.writeFileSync(filePath, template)
      logger.info(`Created new migration: ${filename}`)
      return filePath
    } catch (error) {
      logger.error('Failed to create migration:', error)
      throw error
    }
  }
} 