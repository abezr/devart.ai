import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { Env } from '../index';

/**
 * Creates an authenticated Octokit instance using GitHub App credentials
 * @param env Environment variables containing GitHub App configuration
 * @returns Authenticated Octokit instance
 */
async function getAuthenticatedOctokit(env: Env): Promise<Octokit> {
  // Validate required environment variables
  if (!env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY || !env.GITHUB_INSTALLATION_ID) {
    throw new Error('Missing GitHub App configuration in environment variables');
  }

  try {
    const auth = createAppAuth({
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_PRIVATE_KEY,
      installationId: env.GITHUB_INSTALLATION_ID,
    });
    
    const installationAuthentication = await auth({ type: "installation" });
    return new Octokit({ 
      auth: installationAuthentication.token,
      // Add request timeout for reliability
      request: {
        timeout: 5000
      }
    });
  } catch (error) {
    console.error('Failed to authenticate with GitHub App:', error);
    throw new Error('GitHub App authentication failed');
  }
}

/**
 * Posts a comment to a GitHub Pull Request
 * @param env Environment variables
 * @param owner Repository owner
 * @param repo Repository name
 * @param issue_number Pull Request number
 * @param body Comment content
 * @returns GitHub API response
 */
export async function postPRComment(env: Env, owner: string, repo: string, issue_number: number, body: string) {
  try {
    const octokit = await getAuthenticatedOctokit(env);
    return await octokit.issues.createComment({ owner, repo, issue_number, body });
  } catch (error) {
    console.error(`Failed to post comment to PR ${owner}/${repo}#${issue_number}:`, error);
    throw error;
  }
}

/**
 * Creates a check run (status check) for a commit
 * @param env Environment variables
 * @param owner Repository owner
 * @param repo Repository name
 * @param head_sha Commit SHA to attach the check to
 * @param conclusion Check conclusion (success, failure, neutral)
 * @param title Check title
 * @param summary Check summary
 * @returns GitHub API response
 */
export async function createCheckRun(
  env: Env, 
  owner: string, 
  repo: string, 
  head_sha: string, 
  conclusion: 'success' | 'failure' | 'neutral', 
  title: string, 
  summary: string
) {
  try {
    const octokit = await getAuthenticatedOctokit(env);
    return await octokit.checks.create({ 
      owner, 
      repo, 
      name: 'DevArt.ai Agent Review', 
      head_sha, 
      status: 'completed', 
      conclusion, 
      output: { title, summary } 
    });
  } catch (error) {
    console.error(`Failed to create check run for ${owner}/${repo}@${head_sha}:`, error);
    throw error;
  }
}

/**
 * Updates repository settings or performs other GitHub operations
 * @param env Environment variables
 * @param owner Repository owner
 * @param repo Repository name
 * @param settings Settings to update
 * @returns GitHub API response
 */
export async function updateRepoSettings(env: Env, owner: string, repo: string, settings: any) {
  try {
    const octokit = await getAuthenticatedOctokit(env);
    return await octokit.repos.update({ owner, repo, ...settings });
  } catch (error) {
    console.error(`Failed to update repository settings for ${owner}/${repo}:`, error);
    throw error;
  }
}