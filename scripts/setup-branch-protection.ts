import axios, { AxiosError } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'ReeceHarding';
const REPO = 'new-scraper';

interface GitHubErrorResponse {
  message: string;
}

async function setupBranchProtection() {
  if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/branches/main/protection`;
  
  try {
    const response = await axios.put(url, {
      required_status_checks: {
        strict: true,
        contexts: []
      },
      enforce_admins: true,
      required_pull_request_reviews: {
        dismissal_restrictions: {},
        dismiss_stale_reviews: true,
        require_code_owner_reviews: false,
        required_approving_review_count: 1
      },
      restrictions: null,
      allow_force_pushes: true,
      allow_deletions: true
    }, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    console.log('Branch protection rules set successfully:', response.data);
  } catch (error) {
    const axiosError = error as AxiosError<GitHubErrorResponse>;
    console.error('Error setting branch protection rules:', axiosError.response?.data?.message || axiosError.message);
    process.exit(1);
  }
}

setupBranchProtection(); 