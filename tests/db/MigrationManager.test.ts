import { MigrationManager } from '../../src/lib/db/MigrationManager'
import fs from 'fs'
import path from 'path'
import { supabase } from '../utils/test-utils'

describe('MigrationManager', () => {
  let migrationManager: MigrationManager
  const MIGRATIONS_DIR = path.join(__dirname, '../../migrations')

  beforeAll(() => {
    migrationManager = new MigrationManager()
  })

  beforeEach(async () => {
    // Clean up test data
    await supabase
      .from('schema_versions')
      .delete()
      .neq('version', '0')
  })

  afterEach(() => {
    // Clean up test migration files
    const testFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.includes('test_'))
    testFiles.forEach(file => {
      fs.unlinkSync(path.join(MIGRATIONS_DIR, file))
    })
  })

  it('should get current version', async () => {
    const version = await migrationManager.getCurrentVersion()
    expect(version).toBe('0')
  })

  it('should list migration files', async () => {
    const files = await migrationManager.getMigrationFiles()
    expect(Array.isArray(files)).toBe(true)
    expect(files.every(f => f.endsWith('.sql'))).toBe(true)
  })

  it('should create new migration', async () => {
    const name = 'test_migration'
    const filePath = await migrationManager.createMigration(name)
    
    expect(path.basename(filePath)).toMatch(/^\d{8}_test_migration\.sql$/)
    
    const content = fs.readFileSync(filePath, 'utf8')
    expect(content).toContain(`Migration: ${name}`)
    expect(content).toContain('UP')
    expect(content).toContain('DOWN')
  })

  it('should run migration', async () => {
    const name = 'test_table'
    const filePath = await migrationManager.createMigration(name)
    
    // Add test SQL content
    const sql = `-- Migration: ${name}
-- Created at: ${new Date().toISOString()}

-- UP
CREATE TABLE IF NOT EXISTS test_table (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- DOWN
DROP TABLE IF EXISTS test_table;
`
    fs.writeFileSync(filePath, sql)
    
    await migrationManager.runMigration(path.basename(filePath))
    
    const { error } = await supabase
      .from('schema_versions')
      .select()
      .eq('name', path.basename(filePath))
      .single()
    
    expect(error).toBeNull()
  })

  it('should run all migrations', async () => {
    const migrations = [
      {
        name: 'test_table_1',
        sql: `-- Migration: test_table_1
-- Created at: ${new Date().toISOString()}

-- UP
CREATE TABLE IF NOT EXISTS test_table_1 (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- DOWN
DROP TABLE IF EXISTS test_table_1;
`
      },
      {
        name: 'test_table_2',
        sql: `-- Migration: test_table_2
-- Created at: ${new Date().toISOString()}

-- UP
CREATE TABLE IF NOT EXISTS test_table_2 (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

-- DOWN
DROP TABLE IF EXISTS test_table_2;
`
      }
    ]

    for (const migration of migrations) {
      const filePath = await migrationManager.createMigration(migration.name)
      fs.writeFileSync(filePath, migration.sql)
    }

    await migrationManager.migrate()
    
    const { data, error } = await supabase
      .from('schema_versions')
      .select()
      .order('applied_at', { ascending: true })
    
    expect(error).toBeNull()
    expect(data).toHaveLength(migrations.length)
    expect(data?.map(m => m.name)).toEqual(migrations.map(m => path.basename(m.name)))
  })
}) 