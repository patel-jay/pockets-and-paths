import { DomainError } from '../errors';
import type { BudgetRow } from '../types';
import { requireIsoDate } from './validation';

export function monthStart(value = new Date().toISOString().slice(0, 10)): string {
  return `${requireIsoDate(value, 'Date').slice(0, 7)}-01`;
}

export function validateExpenseDateForBudget(budget: BudgetRow, expenseDate: string): void {
  if (budget.type === 'MONTHLY' && monthStart(expenseDate) < monthStart(budget.start_date)) {
    throw new DomainError('Choose a date on or after this monthly budget starts.');
  }
  if (
    budget.type === 'TEMPORARY' &&
    (expenseDate < budget.start_date || (budget.end_date && expenseDate > budget.end_date))
  ) {
    throw new DomainError('Choose a date inside this temporary budget’s date range.');
  }
}

export async function ensureBudgetPeriod(
  db: D1Database,
  viewerId: string,
  budget: BudgetRow,
  expenseDate: string,
): Promise<string | null> {
  validateExpenseDateForBudget(budget, expenseDate);
  if (budget.type !== 'MONTHLY') return null;

  const periodStart = monthStart(expenseDate);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO budget_periods
         (id, budget_id, viewer_id, period_start, amount_minor, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (budget_id, period_start) DO NOTHING`,
    )
    .bind(id, budget.id, viewerId, periodStart, budget.amount_minor, now)
    .run();

  const period = await db
    .prepare(
      'SELECT id FROM budget_periods WHERE budget_id = ? AND viewer_id = ? AND period_start = ?',
    )
    .bind(budget.id, viewerId, periodStart)
    .first<{ id: string }>();
  if (!period) throw new Error('The monthly budget period could not be created.');

  await db
    .prepare(
      `INSERT OR IGNORE INTO category_period_limits (period_id, category_id, limit_minor)
       SELECT ?, c.id, c.limit_minor_optional
       FROM categories c
       WHERE c.budget_id = ? AND c.viewer_id = ?`,
    )
    .bind(period.id, budget.id, viewerId)
    .run();

  return period.id;
}
