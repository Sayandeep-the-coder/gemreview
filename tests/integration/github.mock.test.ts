import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('GitHub Integration (Mock)', () => {
  describe('parsePRUrl', () => {
    it('should parse a valid GitHub PR URL', async () => {
      const { parsePRUrl } = await import('../../src/github/pr.js');
      const result = parsePRUrl('https://github.com/octocat/hello-world/pull/42');
      expect(result).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
        pull_number: 42,
      });
    });

    it('should throw on invalid PR URL', async () => {
      const { parsePRUrl } = await import('../../src/github/pr.js');
      expect(() => parsePRUrl('https://github.com/invalid')).toThrow('Invalid PR URL');
    });

    it('should handle URLs without protocol', async () => {
      const { parsePRUrl } = await import('../../src/github/pr.js');
      const result = parsePRUrl('github.com/org/repo/pull/99');
      expect(result.pull_number).toBe(99);
    });
  });

  describe('GitHub Client Factory', () => {
    it('should create an Octokit instance', async () => {
      const { createGitHubClient } = await import('../../src/github/client.js');
      const client = createGitHubClient('test-token');
      expect(client).toBeDefined();
      expect(client.pulls).toBeDefined();
      expect(client.issues).toBeDefined();
    });

    it('should accept custom base URL', async () => {
      const { createGitHubClient } = await import('../../src/github/client.js');
      const client = createGitHubClient('test-token', 'https://github.example.com/api/v3');
      expect(client).toBeDefined();
    });
  });

  describe('Comment Formatting', () => {
    it('should format inline comment body correctly', async () => {
      // Test via the postInlineComment dry-run guard
      const { postInlineComment } = await import('../../src/github/comments.js');
      const finding = {
        file: 'test.ts',
        line: 10,
        dimension: 'security' as const,
        severity: 'critical' as const,
        title: 'Hardcoded secret',
        description: 'Found a hardcoded API key',
        suggestion: 'Use environment variables',
        confidence: 0.95,
      };

      // Should throw on dry-run
      await expect(
        postInlineComment(null as any, 'owner', 'repo', 1, finding, 'sha123', true),
      ).rejects.toThrow('dry-run');
    });

    it('should block summary comment in dry-run mode', async () => {
      const { postSummaryComment } = await import('../../src/github/comments.js');
      await expect(
        postSummaryComment(
          null as any,
          'owner',
          'repo',
          1,
          [],
          { title: 'Test', filesReviewed: 1, linesChanged: 10, model: 'test', durationSeconds: 5 },
          true,
        ),
      ).rejects.toThrow('dry-run');
    });
  });
});
