import { DomainError } from '../errors';
import {
  defaultCategoryAppearances,
  monthlyDefaultCategoryNames,
  temporaryDefaultCategoryNames,
} from '../../shared/category-presets';
import type { BudgetRow, BudgetStatus, CreateBudgetInput, UpdateBudgetInput } from '../types';
import { requireCurrency, requireIsoDate, requirePositiveMinor, requireText } from './validation';

export function requireActiveBudget(budget: BudgetRow): void {
  if (budget.status === 'ARCHIVED') {
    throw new DomainError('Restore this budget before making changes.');
  }
}

export async function getBudgets(
  db: D1Database,
  viewerId: string,
  status: BudgetStatus = 'ACTIVE',
): Promise<BudgetRow[]> {
  const { results } = await db
    .prepare(
      `SELECT b.*, COALESCE(SUM(e.converted_amount_minor), 0) AS spent_minor,
              COALESCE((SELECT SUM(c.limit_minor_optional) FROM categories c WHERE c.budget_id = b.id), 0)
                AS allocated_minor
       FROM budgets b
       LEFT JOIN expenses e ON e.budget_id = b.id AND e.viewer_id = b.viewer_id
       WHERE b.viewer_id = ? AND b.status = ?
       GROUP BY b.id
       ORDER BY b.type ASC, b.start_date ASC`,
    )
    .bind(viewerId, status)
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

  const defaultCategoryNames =
    input.type === 'MONTHLY' ? monthlyDefaultCategoryNames : temporaryDefaultCategoryNames;

  await db.batch(
    defaultCategoryNames.map((categoryName) => {
      const appearance = defaultCategoryAppearances[categoryName];
      return db
        .prepare(
          `INSERT INTO categories
           (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, icon_key, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          viewerId,
          categoryName,
          0,
          null,
          appearance.color,
          appearance.icon,
          now,
        );
    }),
  );

  const budget = await getBudget(db, viewerId, id);
  if (!budget) throw new Error('Created budget could not be loaded.');
  return budget;
}

export async function updateBudget(
  db: D1Database,
  viewerId: string,
  input: UpdateBudgetInput,
): Promise<BudgetRow> {
  const existing = await getBudget(db, viewerId, input.budgetId);
  if (!existing) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(existing);

  const name = requireText(input.name, 'Budget name', 60);
  const amountMinor = requirePositiveMinor(input.amountMinor, 'Budget amount');
  const startDate = requireIsoDate(input.startDate, 'Start date');
  const endDate = input.endDate ? requireIsoDate(input.endDate, 'End date') : null;

  if (existing.type === 'TEMPORARY' && !endDate) {
    throw new DomainError('Temporary budgets require an end date.');
  }
  if (endDate && endDate < startDate) {
    throw new DomainError('End date must be on or after the start date.');
  }

  const result = await db
    .prepare(
      `UPDATE budgets
       SET name = ?, amount_minor = ?, start_date = ?, end_date = ?
       WHERE id = ? AND viewer_id = ?`,
    )
    .bind(
      name,
      amountMinor,
      startDate,
      existing.type === 'MONTHLY' ? null : endDate,
      input.budgetId,
      viewerId,
    )
    .run();

  if (result.meta.changes !== 1) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  const budget = await getBudget(db, viewerId, input.budgetId);
  if (!budget) throw new Error('Updated budget could not be loaded.');
  return budget;
}

export async function setBudgetStatus(
  db: D1Database,
  viewerId: string,
  budgetId: string,
  status: BudgetStatus,
): Promise<BudgetRow> {
  const result = await db
    .prepare('UPDATE budgets SET status = ? WHERE id = ? AND viewer_id = ?')
    .bind(status, budgetId, viewerId)
    .run();

  if (result.meta.changes !== 1) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  const budget = await getBudget(db, viewerId, budgetId);
  if (!budget) throw new Error('Updated budget could not be loaded.');
  return budget;
}
