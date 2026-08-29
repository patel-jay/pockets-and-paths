import { describe, expect, it } from 'vitest';
import type { BudgetRow } from '../types';
import { summarizeBalancesByCurrency } from './summaries';

function budget(currency: string, amountMinor: number, spentMinor: number): BudgetRow {
  return {
    id: crypto.randomUUID(),
    viewer_id: 'viewer',
    name: 'Plan',
    type: 'TEMPORARY',
    reporting_currency: currency,
    amount_minor: amountMinor,
    profile_rate_micros: 1_000_000,
    start_date: '2031-01-01',
    end_date: '2031-01-10',
    status: 'ACTIVE',
    created_at: '2030-12-01T00:00:00.000Z',
    spent_minor: spentMinor,
  };
}

describe('summarizeBalancesByCurrency', () => {
  it('groups balances without combining unrelated currencies', () => {
    const result = summarizeBalancesByCurrency([
      budget('INR', 100_000, 25_000),
      budget('JPY', 80_000, 20_000),
      budget('INR', 50_000, 10_000),
    ]);

    expect(result).toEqual([
      { currency: 'INR', remainingMinor: 115_000, overspentMinor: 0, budgetCount: 2 },
      { currency: 'JPY', remainingMinor: 60_000, overspentMinor: 0, budgetCount: 1 },
    ]);
  });

  it('reports overspending separately in each currency', () => {
    const result = summarizeBalancesByCurrency([
      budget('EUR', 50_000, 62_000),
      budget('EUR', 20_000, 5_000),
    ]);

    expect(result).toEqual([
      { currency: 'EUR', remainingMinor: 15_000, overspentMinor: 12_000, budgetCount: 2 },
    ]);
  });
});
