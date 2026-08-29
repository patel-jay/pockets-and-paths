import { describe, expect, it } from 'vitest';
import { optionalSpendingPosition, spendingPosition } from './budget-math';

describe('spendingPosition', () => {
  it('keeps a real percentage above 100 and exposes overspending', () => {
    expect(spendingPosition(12_500, 10_000)).toEqual({
      progress: 125,
      remaining: 0,
      overspent: 2_500,
      isOver: true,
    });
  });

  it('reports the remaining amount while within plan', () => {
    expect(spendingPosition(7_500, 10_000)).toEqual({
      progress: 75,
      remaining: 2_500,
      overspent: 0,
      isOver: false,
    });
  });
});

describe('optionalSpendingPosition', () => {
  it('skips percentage and overspending when a category has no limit', () => {
    expect(optionalSpendingPosition(9_000, null)).toBeNull();
  });
});
