import { DomainError } from '../errors';
import type { BudgetRow, CreateBudgetInput } from '../types';
import { requireCurrency, requireIsoDate, requirePositiveMinor, requireText } from './validation';

const defaultCategoryColors = ['#2e7064', '#e8795d', '#d1a64c', '#6382a8', '#8774a8'];

export async function getBudgets(db: D1Database, viewerId: string): Promise<BudgetRow[]> {
  const { results } = await db
    .prepare(
      `SELECT b.*, COALESCE(SUM(e.converted_amount_minor), 0) AS spent_minor,
              COALESCE((SELECT SUM(c.limit_minor_optional) FROM categories c WHERE c.budget_id = b.id), 0)
                AS allocated_minor
       FROM budgets b
       LEFT JOIN expenses e ON e.budget_id = b.id AND e.viewer_id = b.viewer_id
       WHERE b.viewer_id = ? AND b.status = 'ACTIVE'
       GROUP BY b.id
       ORDER BY b.type ASC, b.start_date ASC`,
    )
    .bind(viewerId)
    .all<BudgetRow>();

  return results;
}

export async function getBudget(
  db: D1Database,
  viewerId: string,
  budgetId: string,
): Promise<BudgetRow | null> {
  return db
    .prepare(
      `SELECT b.*, COALESCE(SUM(e.converted_amount_minor), 0) AS spent_minor,
              COALESCE((SELECT SUM(c.limit_minor_optional) FROM categories c WHERE c.budget_id = b.id), 0)
                AS allocated_minor
       FROM budgets b
       LEFT JOIN expenses e ON e.budget_id = b.id AND e.viewer_id = b.viewer_id
       WHERE b.viewer_id = ? AND b.id = ?
       GROUP BY b.id`,
    )
    .bind(viewerId, budgetId)
    .first<BudgetRow>();
}

export async function createBudget(
  db: D1Database,
  viewerId: string,
  input: CreateBudgetInput,
): Promise<BudgetRow> {
  const amountMinor = requirePositiveMinor(input.amountMinor, 'Budget amount');
  const currency = requireCurrency(input.currency);
  const name = requireText(input.name, 'Budget name', 60);
  const startDate = requireIsoDate(input.startDate, 'Start date');
  const endDate = input.endDate ? requireIsoDate(input.endDate, 'End date') : null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (input.type !== 'MONTHLY' && input.type !== 'TEMPORARY') {
    throw new DomainError('Choose a supported budget type.');
  }
  if (input.type === 'TEMPORARY' && !endDate) {
    throw new DomainError('Temporary budgets require an end date.');
  }
  if (endDate && endDate < startDate) {
    throw new DomainError('End date must be on or after the start date.');
  }

  await db
    .prepare(
      `INSERT INTO budgets (
        id, viewer_id, name, type, reporting_currency, amount_minor,
        profile_rate_micros, start_date, end_date, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    )
    .bind(id, viewerId, name, input.type, currency, amountMinor, 1_000_000, startDate, endDate, now)
    .run();

  const defaultCategories =
    input.type === 'MONTHLY'
      ? ['Food', 'Housing', 'Transport', 'Leisure']
      : ['Transport', 'Stay', 'Food', 'Experiences'];

  await db.batch(
    defaultCategories.map((categoryName, index) =>
      db
        .prepare(
          `INSERT INTO categories
           (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          viewerId,
          categoryName,
          0,
          null,
          defaultCategoryColors[index],
          now,
        ),
    ),
  );

  const budget = await getBudget(db, viewerId, id);
  if (!budget) throw new Error('Created budget could not be loaded.');
  return budget;
}
