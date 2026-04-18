import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { workspaceService } from '../src/services/workspace.js';

const tempDirs: string[] = [];

function makeWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'openmeta-workspace-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('workspaceService.applyGeneratedChanges', () => {
  test('writes updated files inside the workspace and returns relative paths', () => {
    const workspacePath = makeWorkspace();
    const filePath = join(workspacePath, 'src', 'button.ts');
    mkdirSync(join(workspacePath, 'src'), { recursive: true });
    writeFileSync(filePath, 'export const button = 1;\n', 'utf-8');

    const changedFiles = workspaceService.applyGeneratedChanges(workspacePath, [
      {
        path: 'src/button.ts',
        reason: 'Update implementation',
        content: 'export const button = 2;\n',
      },
    ]);

    expect(changedFiles).toEqual(['src/button.ts']);
    expect(readFileSync(filePath, 'utf-8')).toBe('export const button = 2;\n');
  });

  test('skips unsafe paths outside the workspace', () => {
    const workspacePath = makeWorkspace();
    const outsidePath = join(workspacePath, '..', 'escape.ts');

    const changedFiles = workspaceService.applyGeneratedChanges(workspacePath, [
      {
        path: '../escape.ts',
        reason: 'Unsafe path',
        content: 'export const leaked = true;\n',
      },
    ]);

    expect(changedFiles).toEqual([]);
    expect(existsSync(outsidePath)).toBe(false);
  });

  test('does not report files whose content is unchanged', () => {
    const workspacePath = makeWorkspace();
    const filePath = join(workspacePath, 'README.md');
    writeFileSync(filePath, '# Demo\n', 'utf-8');

    const changedFiles = workspaceService.applyGeneratedChanges(workspacePath, [
      {
        path: 'README.md',
        reason: 'No-op',
        content: '# Demo\n',
      },
    ]);

    expect(changedFiles).toEqual([]);
  });
});
