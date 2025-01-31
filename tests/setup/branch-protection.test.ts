import axios from 'axios';
import { config } from 'dotenv';

config({ path: '.env.test' });

describe('Branch Protection Rules', () => {
  const REPO_OWNER = process.env.GITHUB_REPOSITORY_OWNER;
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

  beforeAll(() => {
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }
    if (!REPO_OWNER) {
      throw new Error('GITHUB_REPOSITORY_OWNER environment variable is required');
    }
  });

  it('should have branch protection enabled for main branch', async () => {
    const response = await axios.get(
      `https://api.github.com/repos/${REPO_OWNER}/new-scraper/branches/main/protection`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.required_status_checks).toBeDefined();
    expect(response.data.enforce_admins.enabled).toBe(true);
  });

  it('should require status checks to pass before merging', async () => {
    const response = await axios.get(
      `https://api.github.com/repos/${REPO_OWNER}/new-scraper/branches/main/protection/required_status_checks`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    expect(response.status).toBe(200);
    expect(response.data.strict).toBe(true);
    expect(response.data.contexts).toHaveLength(1);
    expect(response.data.contexts[0]).toBe('test');
  });
}); 