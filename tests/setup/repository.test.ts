import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Repository Setup', () => {
  it('should have correct remote URL', () => {
    const remoteUrl = execSync('git remote get-url origin').toString().trim();
    expect(remoteUrl).toMatch(/github\.com.*\/new-scraper/);
  });

  it('should have branch protection rules', async () => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    const owner = process.env.GITHUB_REPOSITORY_OWNER;
    if (!owner) {
      throw new Error('GITHUB_REPOSITORY_OWNER environment variable is required');
    }

    const protection = await fetch(
      `https://api.github.com/repos/${owner}/new-scraper/branches/main/protection`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    ).then(res => res.json());

    expect(protection.required_status_checks).toBeDefined();
    expect(protection.enforce_admins.enabled).toBe(true);
    expect(protection.required_pull_request_reviews).toBeDefined();
  });

  it('should have GitHub Actions workflows', async () => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    const owner = process.env.GITHUB_REPOSITORY_OWNER;
    if (!owner) {
      throw new Error('GITHUB_REPOSITORY_OWNER environment variable is required');
    }

    const workflows = await fetch(
      `https://api.github.com/repos/${owner}/new-scraper/actions/workflows`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    ).then(res => res.json());

    expect(workflows.total_count).toBeGreaterThan(0);
  });

  it('should be on main branch', () => {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    expect(currentBranch).toBe('main');
  });

  it('should have commits', () => {
    const hasCommits = execSync('git log --oneline').toString().trim();
    expect(hasCommits).toContain('commit');
  });

  it('should have migrations directory', () => {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    expect(fs.existsSync(migrationsDir)).toBe(true);
    expect(fs.readdirSync(migrationsDir).length).toBeGreaterThan(0);
  });
}); 