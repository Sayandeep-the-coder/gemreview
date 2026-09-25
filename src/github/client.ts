import { Octokit } from '@octokit/rest';

export function createGitHubClient(token: string, baseUrl: string = 'https://api.github.com'): Octokit {
  return new Octokit({
    auth: token,
    baseUrl,
  });
}
