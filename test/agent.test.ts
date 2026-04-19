import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AgentOrchestrator } from '../src/orchestration/agent.js';
import { llmService, workspaceService } from '../src/services/index.js';
import { createRankedIssue, createWorkspace } from './helpers/factories.js';

interface AgentInternals {
  parseDraftPullRequest(prDraft: string, issue: ReturnType<typeof createRankedIssue>): {
    title: string;
    body: string;
  };
  formatValidationSummary(results: Array<{
    command: string;
    exitCode: number | null;
    passed: boolean;
    output: string;
  }>): string;
  generateConcretePatch(
    issue: ReturnType<typeof createRankedIssue>,
    workspace: ReturnType<typeof createWorkspace>,
    patchDraft: string,
    runChecks: boolean,
  ): Promise<{
    changedFiles: string[];
    validationResults: Array<{
      command: string;
      exitCode: number | null;
      passed: boolean;
      output: string;
    }>;
  }>;
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('AgentOrchestrator draft PR parsing', () => {
  test('extracts the title from the explicit Title line', () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentInternals;
    const parsed = orchestrator.parseDraftPullRequest([
      'Title: Add aria-label attributes to icon-only buttons',
      '',
      '## Summary',
      'Add accessible labels across key UI buttons.',
    ].join('\n'), createRankedIssue());

    expect(parsed.title).toBe('Add aria-label attributes to icon-only buttons');
    expect(parsed.body).toContain('## Summary');
    expect(parsed.body).not.toContain('Title:');
  });

  test('marks exit code 127 validations as unavailable instead of failed', () => {
    const orchestrator = new AgentOrchestrator() as unknown as AgentInternals;
    const summary = orchestrator.formatValidationSummary([
      {
        command: 'npm run lint',
        exitCode: 127,
        passed: false,
        output: 'sh: npm: command not found',
      },
    ]);

    expect(summary).toBe('npm run lint=unavailable (127)');
  });

  test('attempts a single validation repair pass after blocking failures', async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), 'openmeta-agent-'));
    tempDirs.push(workspacePath);
    mkdirSync(join(workspacePath, 'src'), { recursive: true });
    writeFileSync(join(workspacePath, 'src', 'app.ts'), 'export const version = 0;\n', 'utf-8');

    const originalGenerateImplementationDraft = llmService.generateImplementationDraft;
    const originalGenerateImplementationRepairDraft = llmService.generateImplementationRepairDraft;
    const originalRunValidationCommands = workspaceService.runValidationCommands;

    let validationRuns = 0;

    try {
      llmService.generateImplementationDraft = async () => ({
        summary: 'Initial patch',
        fileChanges: [
          {
            path: 'src/app.ts',
            reason: 'Apply the initial implementation',
            content: 'export const version = 1;\n',
          },
        ],
      });

      llmService.generateImplementationRepairDraft = async () => ({
        summary: 'Repair patch',
        fileChanges: [
          {
            path: 'src/app.ts',
            reason: 'Fix the failing validation path',
            content: 'export const version = 2;\n',
          },
        ],
      });

      workspaceService.runValidationCommands = () => {
        validationRuns += 1;
        return validationRuns === 1
          ? [{ command: 'pytest', exitCode: 1, passed: false, output: 'AssertionError: expected version 2' }]
          : [{ command: 'pytest', exitCode: 0, passed: true, output: '1 passed' }];
      };

      const orchestrator = new AgentOrchestrator() as unknown as AgentInternals;
      const result = await orchestrator.generateConcretePatch(
        createRankedIssue(),
        createWorkspace({
          workspacePath,
          snippets: [{ path: 'src/app.ts', content: 'export const version = 0;\n' }],
          testCommands: [{ command: 'pytest', reason: 'Detected pyproject.toml', source: 'tool-default' }],
          validationCommands: [{ command: 'pytest', reason: 'Detected pyproject.toml', source: 'tool-default' }],
          validationWarnings: [],
          testResults: [],
        }),
        'Patch draft body',
        true,
      );

      expect(validationRuns).toBe(2);
      expect(result.changedFiles).toEqual(['src/app.ts']);
      expect(result.validationResults[0]?.passed).toBe(true);
      expect(readFileSync(join(workspacePath, 'src', 'app.ts'), 'utf-8')).toBe('export const version = 2;\n');
    } finally {
      llmService.generateImplementationDraft = originalGenerateImplementationDraft;
      llmService.generateImplementationRepairDraft = originalGenerateImplementationRepairDraft;
      workspaceService.runValidationCommands = originalRunValidationCommands;
    }
  });
});
