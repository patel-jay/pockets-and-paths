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
}

function endOfYear(year: number): string {
  return `${year}-12-01`;
}

export async function ensureBudgetPeriods(
  db: D1Database,
  viewerId: string,
  budget: BudgetRow,
  fromDate: string,
  throughDate: string,
): Promise<void> {
  if (budget.type !== 'MONTHLY') return;

  const firstPeriod = [monthStart(fromDate), monthStart(budget.start_date)].sort().at(-1)!;
  const lastPeriod = monthStart(throughDate);
  if (firstPeriod > lastPeriod) return;

  const now = new Date().toISOString();
  await db
    .prepare(
      `WITH RECURSIVE months(period_start) AS (
         SELECT ?
         UNION ALL
         SELECT date(period_start, '+1 month')
         FROM months
         WHERE period_start < ?
       )
       INSERT INTO budget_periods
         (id, budget_id, viewer_id, period_start, amount_minor, created_at)
       SELECT lower(hex(randomblob(16))), ?, ?, period_start, ?, ?
       FROM months
       WHERE true
       ON CONFLICT (budget_id, period_start) DO NOTHING`,
    )
    .bind(firstPeriod, lastPeriod, budget.id, viewerId, budget.amount_minor, now)
    .run();

  await db
    .prepare(
      `INSERT OR IGNORE INTO category_period_limits (period_id, category_id, limit_minor)
       SELECT p.id, c.id, c.limit_minor_optional
       FROM budget_periods p
       JOIN categories c
         ON c.budget_id = p.budget_id AND c.viewer_id = p.viewer_id
       WHERE p.budget_id = ? AND p.viewer_id = ?
         AND p.period_start BETWEEN ? AND ?`,
    )
    .bind(budget.id, viewerId, firstPeriod, lastPeriod)
    .run();
}

export async function ensureViewerYearPeriods(
  db: D1Database,
  viewerId: string,
  year = new Date().getUTCFullYear(),
): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT * FROM budgets
       WHERE viewer_id = ? AND type = 'MONTHLY' AND status = 'ACTIVE'
         AND start_date <= ?
       ORDER BY start_date ASC`,
    )
    .bind(viewerId, `${year}-12-31`)
    .all<BudgetRow>();

  for (const budget of results) {
    await ensureBudgetPeriods(db, viewerId, budget, `${year}-01-01`, endOfYear(year));
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
  await ensureBudgetPeriods(db, viewerId, budget, periodStart, periodStart);

  const period = await db
    .prepare(
      'SELECT id FROM budget_periods WHERE budget_id = ? AND viewer_id = ? AND period_start = ?',
    )
    .bind(budget.id, viewerId, periodStart)
    .first<{ id: string }>();
  if (!period) throw new Error('The monthly budget period could not be created.');

  return period.id;
}
