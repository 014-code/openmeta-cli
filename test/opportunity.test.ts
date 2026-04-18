import { describe, expect, test } from 'bun:test';
import { opportunityService } from '../src/services/opportunity.js';
import { createMatchedIssue } from './helpers/factories.js';

describe('opportunityService', () => {
  test('ranks issues by combined opportunity and match scores', () => {
    const issues = [
      createMatchedIssue({
        number: 1,
        title: 'Stale docs update',
        updatedAt: '2026-03-01T08:00:00.000Z',
        repoStars: 5,
        matchScore: 65,
        labels: ['help wanted'],
      }),
      createMatchedIssue({
        number: 2,
        title: 'High-signal accessibility fix',
        updatedAt: new Date().toISOString(),
        repoStars: 420,
        matchScore: 88,
        labels: ['good first issue', 'help wanted'],
      }),
    ];

    const ranked = opportunityService.rankIssues(issues);

    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.number).toBe(2);
    expect(ranked[0]?.opportunity.overallScore).toBeGreaterThan(ranked[1]?.opportunity.overallScore ?? 0);
    expect(ranked[0]?.opportunity.summary).toContain('Strongest signal');
  });

  test('includes technical fit in the opportunity breakdown', () => {
    const ranked = opportunityService.rankIssues([
      createMatchedIssue({ matchScore: 73 }),
    ]);

    expect(ranked[0]?.opportunity.breakdown.technicalFit).toBe(73);
  });
});
