import type { Octokit } from '@octokit/rest';

export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  patch: string;
  additions: number;
  deletions: number;
}

export interface PRInfo {
  owner: string;
  repo: string;
  pull_number: number;
}

export interface PRMeta {
  title: string;
  description: string;
  branch: string;
  headSha: string;
}

export function parsePRUrl(url: string): PRInfo {
  const match = url.match(
    /(?:https?:\/\/)?(?:[^/]+\/)?([^/]+)\/([^/]+)\/pull\/(\d+)/,
  );
  if (!match) {
    throw new Error(
      `Invalid PR URL: "${url}". Expected format: https://github.com/<owner>/<repo>/pull/<number>`,
    );
  }
  return {
    owner: match[1],
    repo: match[2],
    pull_number: parseInt(match[3], 10),
  };
}

export async function fetchPRMeta(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number,
): Promise<PRMeta> {
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
  });

  return {
    title: data.title,
    description: data.body || '',
    branch: data.head.ref,
    headSha: data.head.sha,
  };
}

export async function fetchDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  pull_number: number,
): Promise<FileDiff[]> {
  const files: FileDiff[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page: perPage,
      page,
    });

    if (data.length === 0) break;

    for (const file of data) {
      // Skip binary files (no patch available)
      if (!file.patch) continue;

      const status = file.status as FileDiff['status'];
      files.push({
        filename: file.filename,
        status,
        patch: file.patch,
        additions: file.additions,
        deletions: file.deletions,
      });
    }

    if (data.length < perPage) break;
    page++;
  }

  return files;
}
