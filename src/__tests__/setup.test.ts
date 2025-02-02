import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe('Development Environment Setup', () => {
  const rootDir = process.cwd();

  test('Node.js version is 18 or higher', () => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    expect(majorVersion).toBeGreaterThanOrEqual(18);
  });

  test('TypeScript is configured correctly', () => {
    const tsConfigPath = path.join(rootDir, 'tsconfig.json');
    expect(fs.existsSync(tsConfigPath)).toBe(true);
    
    const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
    expect(tsConfig.compilerOptions).toBeDefined();
    expect(tsConfig.compilerOptions.strict).toBe(true);
  });

  test('ESLint is configured correctly', () => {
    const eslintConfigPath = path.join(rootDir, 'eslint.config.mjs');
    expect(fs.existsSync(eslintConfigPath)).toBe(true);
  });

  test('Prettier is configured correctly', () => {
    const prettierConfigPath = path.join(rootDir, '.prettierrc');
    expect(fs.existsSync(prettierConfigPath)).toBe(true);
  });

  test('Required development dependencies are installed', () => {
    const packageJsonPath = path.join(rootDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const requiredDevDeps = [
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@types/jest',
      'typescript',
      'eslint',
      'prettier'
    ];

    requiredDevDeps.forEach(dep => {
      expect(packageJson.devDependencies[dep] || packageJson.dependencies[dep]).toBeDefined();
    });
  });

  test('Git hooks are set up', () => {
    const gitHooksPath = path.join(rootDir, '.git', 'hooks');
    expect(fs.existsSync(gitHooksPath)).toBe(true);
    
    const preCommitHookPath = path.join(gitHooksPath, 'pre-commit');
    expect(fs.existsSync(preCommitHookPath)).toBe(true);
  });
}); 