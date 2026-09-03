import { describe, expect, it } from 'vitest';
import { getBudgetPhase } from '../../shared/budget-phase';

describe('getBudgetPhase', () => {
  it('marks a plan that starts later as upcoming', () => {
    expect(
      getBudgetPhase(
        { type: 'TEMPORARY', startDate: '2031-03-10', endDate: '2031-03-20' },
        '2031-03-01',
      ),
    ).toBe('UPCOMING');
  });

  it('includes both boundary dates in an active temporary plan', () => {
    const plan = { type: 'TEMPORARY' as const, startDate: '2031-03-10', endDate: '2031-03-20' };

    expect(getBudgetPhase(plan, '2031-03-10')).toBe('ACTIVE');
    expect(getBudgetPhase(plan, '2031-03-20')).toBe('ACTIVE');
  });

  it('marks a temporary plan after its end date as ended', () => {
    expect(
      getBudgetPhase(
        { type: 'TEMPORARY', startDate: '2031-03-10', endDate: '2031-03-20' },
        '2031-03-21',
      ),
    ).toBe('ENDED');
  });

  it('keeps a recurring monthly plan active after its start date', () => {
    expect(
      getBudgetPhase({ type: 'MONTHLY', startDate: '2031-03-01', endDate: null }, '2031-05-01'),
    ).toBe('ACTIVE');
  });
});
