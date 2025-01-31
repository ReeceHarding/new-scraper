import { fs, path, MIGRATIONS_DIR } from '../utils/test-utils';

describe('Database Migration System', () => {
  it('should have a migrations directory', () => {
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
  });

  it('should have an initial schema migration', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    expect(files.some(f => f.includes('initial_schema'))).toBe(true);
  });

  it('should have valid SQL content in all migration files', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    files.forEach(file => {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      expect(content).toContain('--');  // Should have comments
      expect(content).toMatch(/CREATE|ALTER|DROP|INSERT|UPDATE|DELETE/i);  // Should have SQL commands
    });
  });

  it('should have migration files in chronological order', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const dates = files.map(f => f.split('_')[0]);
    const sortedDates = [...dates].sort();
    expect(dates).toEqual(sortedDates);
  });

  it('should have unique migration names', () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const names = files.map(f => f.split('_').slice(1).join('_'));
    const uniqueNames = new Set(names);
    expect(names.length).toBe(uniqueNames.size);
  });
}); 