import { execSync } from 'child_process';
import { expect } from 'chai';

describe('Git Repository Setup', () => {
  it('should have correct remote origin URL', () => {
    const remoteUrl = execSync('git config --get remote.origin.url').toString().trim();
    expect(remoteUrl).to.match(/^(https:\/\/github\.com\/|git@github\.com:).+\/new-scraper\.git$/);
  });

  it('should be on main branch', () => {
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    expect(currentBranch).to.equal('main');
  });

  it('should have initial commit', () => {
    const hasCommits = execSync('git log -n 1').toString().trim();
    expect(hasCommits).to.include('commit');
  });

  it('should have .gitkeep file', () => {
    const files = execSync('git ls-files').toString().trim().split('\n');
    expect(files).to.include('.gitkeep');
  });
}); 