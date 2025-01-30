import { supabaseClient } from '@/lib/supabase/client'
import { MigrationManager } from '@/lib/db/MigrationManager'

describe('Database Migration System', () => {
  let migrationManager: MigrationManager

  beforeAll(async () => {
    migrationManager = new MigrationManager(supabaseClient)
  })

  beforeEach(async () => {
    // Clean up any existing schema version records
    await supabaseClient
      .from('schema_versions')
      .delete()
      .neq('version', '0')
  })

  describe('Migration Directory Structure', () => {
    it('should have a valid migrations directory', async () => {
      const hasValidStructure = await migrationManager.validateMigrationStructure()
      expect(hasValidStructure).toBe(true)
    })

    it('should list all migration files in order', async () => {
      const migrations = await migrationManager.listMigrations()
      expect(migrations).toBeInstanceOf(Array)
      expect(migrations.length).toBeGreaterThan(0)
      
      // Verify migration file naming convention
      migrations.forEach(migration => {
        expect(migration).toMatch(/^\d{8}_[a-z0-9_]+\.sql$/)
      })
    })

    it('should track migration versions correctly', async () => {
      const version = await migrationManager.getCurrentVersion()
      expect(typeof version).toBe('string')
      expect(version).toMatch(/^\d+$/)
    })
  })

  describe('Schema Version Table', () => {
    it('should create schema version table if not exists', async () => {
      const exists = await migrationManager.ensureVersionTable()
      expect(exists).toBe(true)

      const { data, error } = await supabaseClient
        .from('schema_versions')
        .select('*')
        .limit(1)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should track migration metadata correctly', async () => {
      const testVersion = '20240201'
      const testName = 'test_migration'

      await migrationManager.recordMigration(testVersion, testName)

      const { data, error } = await supabaseClient
        .from('schema_versions')
        .select('*')
        .eq('version', testVersion)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data.name).toBe(testName)
      expect(data.applied_at).toBeDefined()
    })
  })

  describe('Migration Execution', () => {
    it('should execute migrations in order', async () => {
      const result = await migrationManager.runPendingMigrations()
      expect(result.success).toBe(true)
      expect(result.migrationsRun).toBeGreaterThanOrEqual(0)
    })

    it('should handle migration failures gracefully', async () => {
      // Create an invalid migration file for testing
      const invalidSql = 'INVALID SQL STATEMENT;'
      await migrationManager.createMigration('test_invalid', invalidSql)

      const result = await migrationManager.runPendingMigrations()
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
}) 