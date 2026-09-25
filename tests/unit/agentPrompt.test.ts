import { describe, it, expect } from 'vitest';
import { generateAgentPrompt } from '../../src/output/agentPrompt.js';
import type { Finding } from '../../src/gemini/parser.js';
import type { FileDiff } from '../../src/github/pr.js';

const mockFinding: Finding = {
  file:        'src/auth/login.ts',
  line:        42,
  dimension:   'security',
  severity:    'critical',
  title:       'Hardcoded API key detected',
  description: 'An API key is hardcoded directly in source code.',
  suggestion:  'Move to process.env.API_KEY and add to .env.example',
  confidence:  0.97,
};

const mockDiff: FileDiff = {
  filename:  'src/auth/login.ts',
  status:    'modified',
  additions: 5,
  deletions: 2,
  patch: `@@ -40,6 +40,8 @@
 const router = express.Router();
+const API_KEY = 'sk-prod-abc123supersecret';
+
 router.post('/login', async (req, res) => {`,
};

describe('generateAgentPrompt', () => {
  it('returns a clean no-findings message when findings array is empty', () => {
    const result = generateAgentPrompt({
      findings: [], diffs: [], prUrl: 'https://github.com/org/repo/pull/1',
      prTitle: 'Empty PR', model: 'gemini-2.5-pro',
    });
    expect(result).toContain('No findings to fix');
  });

  it('includes the file path tagged in a code block', () => {
    const result = generateAgentPrompt({
      findings: [mockFinding], diffs: [mockDiff],
      prUrl: 'https://github.com/org/repo/pull/1',
      prTitle: 'Test PR', model: 'gemini-2.5-pro',
    });
    expect(result).toContain('File: src/auth/login.ts');
    expect(result).toContain('Line: 42');
  });

  it('includes the patch context with the ISSUE HERE marker', () => {
    const result = generateAgentPrompt({
      findings: [mockFinding], diffs: [mockDiff],
      prUrl: 'https://github.com/org/repo/pull/1',
      prTitle: 'Test PR', model: 'gemini-2.5-pro',
    });
    expect(result).toContain('◀ ISSUE HERE');
  });

  it('includes the suggestion in the Fix section', () => {
    const result = generateAgentPrompt({
      findings: [mockFinding], diffs: [mockDiff],
      prUrl: 'https://github.com/org/repo/pull/1',
      prTitle: 'Test PR', model: 'gemini-2.5-pro',
    });
    expect(result).toContain('process.env.API_KEY');
  });

  it('includes a done-criteria checklist item for the finding', () => {
    const result = generateAgentPrompt({
      findings: [mockFinding], diffs: [mockDiff],
      prUrl: 'https://github.com/org/repo/pull/1',
      prTitle: 'Test PR', model: 'gemini-2.5-pro',
    });
    expect(result).toContain('- [ ] Line 42:');
  });

  it('groups multiple findings from the same file under one file header', () => {
    const finding2: Finding = {
      ...mockFinding, line: 55, dimension: 'bugs', severity: 'high',
      title: 'Null dereference risk',
      description: 'user object may be null',
      suggestion: 'Add null check before access',
    };
    const result = generateAgentPrompt({
      findings: [mockFinding, finding2], diffs: [mockDiff],
      prUrl: 'https://github.com/org/repo/pull/1',
      prTitle: 'Test PR', model: 'gemini-2.5-pro',
    });
    // File header should appear only once
    const fileHeaderCount = (result.match(/📄 `src\/auth\/login\.ts`/g) ?? []).length;
    expect(fileHeaderCount).toBe(1);
  });

  it('sorts findings with critical before high within a file', () => {
    const highFinding: Finding = {
      ...mockFinding, severity: 'high', line: 10, title: 'High severity issue',
    };
    const result = generateAgentPrompt({
      findings: [highFinding, mockFinding], diffs: [mockDiff],
      prUrl: 'https://github.com/org/repo/pull/1',
      prTitle: 'Test PR', model: 'gemini-2.5-pro',
    });
    const criticalPos = result.indexOf('CRITICAL');
    const highPos     = result.indexOf('HIGH');
    expect(criticalPos).toBeLessThan(highPos);
  });
});
