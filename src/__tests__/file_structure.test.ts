import fs from 'fs';
import path from 'path';

describe('File Structure', () => {
  const rootDir = process.cwd();

  test('required directories exist', () => {
    const requiredDirs = [
      'src/components',
      'src/components/auth',
      'src/components/common',
      'src/components/dashboard',
      'src/components/leads',
      'src/components/search',
      'src/components/campaigns',
      'src/api',
      'src/api/auth',
      'src/api/search',
      'src/api/leads',
      'src/api/campaigns',
      'src/store',
      'src/store/auth',
      'src/store/search',
      'src/store/leads',
      'src/store/campaigns',
      'src/__tests__',
      'src/__tests__/components',
      'src/__tests__/api',
      'src/__tests__/store',
      'src/__tests__/utils',
      'public/assets',
      'public/static',
      'config',
    ];

    requiredDirs.forEach(dir => {
      const fullPath = path.join(rootDir, dir);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  }, 30000);

  test('required files exist', () => {
    const requiredFiles = [
      'package.json',
      'tsconfig.json',
      '.env.example',
      '.gitignore',
      'README.md',
      'src/api/client.ts',
      'src/api/config.ts',
      'src/api/types.ts',
      'src/store/index.ts',
      'src/store/types.ts',
    ];

    requiredFiles.forEach(file => {
      const fullPath = path.join(rootDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  }, 30000);
}); 