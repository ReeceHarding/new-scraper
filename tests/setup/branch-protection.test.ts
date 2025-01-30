import { expect } from 'chai';
import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'ReeceHarding';
const REPO = 'new-scraper';

interface BranchProtection {
  required_status_checks: {
    strict: boolean;
  };
  enforce_admins: {
    enabled: boolean;
  };
  required_pull_request_reviews: {
    dismiss_stale_reviews: boolean;
    required_approving_review_count: number;
  };
  allow_force_pushes: {
    enabled: boolean;
  };
  allow_deletions: {
    enabled: boolean;
  };
}

interface GitHubErrorResponse {
  message: string;
}

describe('Branch Protection Setup', () => {
  it('should have branch protection enabled for main branch', async () => {
    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN environment variable is required');
    }

    const url = `https://api.github.com/repos/${OWNER}/${REPO}/branches/main/protection`;
    
    try {
      const response = await axios.get<BranchProtection>(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      const protection = response.data;
      
      expect(protection.required_status_checks.strict).to.be.true;
      expect(protection.enforce_admins.enabled).to.be.true;
      expect(protection.required_pull_request_reviews.dismiss_stale_reviews).to.be.true;
      expect(protection.required_pull_request_reviews.required_approving_review_count).to.equal(1);
      expect(protection.allow_force_pushes.enabled).to.be.true;
      expect(protection.allow_deletions.enabled).to.be.true;
    } catch (error) {
      const axiosError = error as AxiosError<GitHubErrorResponse>;
      throw new Error(`Failed to get branch protection: ${axiosError.response?.data?.message || axiosError.message}`);
    }
  });
}); 