import type { BudgetRow, CategoryRow, CreateCategoryInput, UpdateCategoryInput } from '../types';
import { DomainError } from '../errors';
import { getBudget, requireActiveBudget } from './budgets';
import { monthStart } from './periods';
import {
  optionalPositiveMinor,
  requireCategoryIcon,
  requireColor,
  requireText,
} from './validation';

export async function getCategories(
  db: D1Database,
  viewerId: string,
  budgetId: string,
  options: { periodId?: string | null; periodScoped?: boolean } = {},
): Promise<CategoryRow[]> {
  const periodScoped = options.periodScoped ? 1 : 0;
  const periodId = options.periodId ?? null;
  const { results } = await db
    .prepare(
      `SELECT c.id, c.budget_id, c.viewer_id, c.name, c.limit_minor,
              CASE
                WHEN ? = 1 AND ? IS NOT NULL THEN cpl.limit_minor
                ELSE c.limit_minor_optional
              END AS limit_minor_optional,
              c.color, c.icon_key, c.created_at,
              COALESCE(SUM(e.converted_amount_minor), 0) AS spent_minor
       FROM categories c
       LEFT JOIN category_period_limits cpl
         ON cpl.category_id = c.id AND cpl.period_id = ?
       LEFT JOIN expenses e
         ON e.category_id = c.id AND e.viewer_id = c.viewer_id
        AND (? = 0 OR e.period_id = ?)
       WHERE c.viewer_id = ? AND c.budget_id = ?
       GROUP BY c.id
       ORDER BY c.created_at ASC`,
    )
    .bind(periodScoped, periodId, periodId, periodScoped, periodId, viewerId, budgetId)
    .all<CategoryRow>();

  return results;
}

export async function createCategory(
  db: D1Database,
  viewerId: string,
  input: CreateCategoryInput,
): Promise<CategoryRow> {
  const budget = await getBudget(db, viewerId, input.budgetId);
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(budget);
  const name = requireText(input.name, 'Category name', 40);
  const limitMinor = optionalPositiveMinor(input.limitMinor, 'Category limit');
  const color = requireColor(input.color);
  const icon = requireCategoryIcon(input.icon);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO categories
       (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, icon_key, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.budgetId, viewerId, name, limitMinor ?? 0, limitMinor, color, icon, now)
    .run();

  if (budget.type === 'MONTHLY') {
    await db
      .prepare(
        `INSERT OR IGNORE INTO category_period_limits (period_id, category_id, limit_minor)
         SELECT p.id, ?, ? FROM budget_periods p
         WHERE p.budget_id = ? AND p.viewer_id = ? AND p.period_start >= ?`,
      )
      .bind(id, limitMinor, input.budgetId, viewerId, monthStart())
      .run();
  }

  const category = await db
    .prepare('SELECT *, 0 AS spent_minor FROM categories WHERE id = ? AND viewer_id = ?')
    .bind(id, viewerId)
    .first<CategoryRow>();
  if (!category) throw new Error('Created category could not be loaded.');
  return category;
}

export async function updateCategory(
  db: D1Database,
  viewerId: string,
  input: UpdateCategoryInput,
): Promise<CategoryRow> {
  const existing = await db
    .prepare('SELECT budget_id FROM categories WHERE id = ? AND viewer_id = ?')
    .bind(input.categoryId, viewerId)
    .first<Pick<CategoryRow, 'budget_id'>>();
  if (!existing) throw new DomainError('Category was not found.', 'NOT_FOUND');
  const budget = await getBudget(db, viewerId, existing.budget_id);
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(budget);

  const limitMinor = optionalPositiveMinor(input.limitMinor, 'Category limit');
  const color = requireColor(input.color);
  const icon = requireCategoryIcon(input.icon);
  const result = await db
    .prepare(
      `UPDATE categories
       SET limit_minor = ?, limit_minor_optional = ?, color = ?, icon_key = ?
       WHERE id = ? AND viewer_id = ?`,
    )
    .bind(limitMinor ?? 0, limitMinor, color, icon, input.categoryId, viewerId)
    .run();
  if (result.meta.changes !== 1) throw new DomainError('Category was not found.', 'NOT_FOUND');

  if (budget.type === 'MONTHLY') {
    await db
      .prepare(
        `UPDATE category_period_limits SET limit_minor = ?
         WHERE category_id = ? AND period_id IN (
           SELECT id FROM budget_periods
           WHERE budget_id = ? AND viewer_id = ? AND period_start >= ?
         )`,
      )
      .bind(limitMinor, input.categoryId, budget.id, viewerId, monthStart())
      .run();
  }

  const category = await db
    .prepare(
      `SELECT c.*, COALESCE(SUM(e.converted_amount_minor), 0) AS spent_minor
       FROM categories c
       LEFT JOIN expenses e ON e.category_id = c.id AND e.viewer_id = c.viewer_id
       WHERE c.id = ? AND c.viewer_id = ?
       GROUP BY c.id`,
    )
    .bind(input.categoryId, viewerId)
    .first<CategoryRow>();
  if (!category) throw new Error('Updated category could not be loaded.');
  return category;
}

export async function splitCategoryLimits(
  db: D1Database,
  viewerId: string,
  budgetId: string,
): Promise<BudgetRow> {
  const budget = await getBudget(db, viewerId, budgetId);
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(budget);
  const categories = await getCategories(db, viewerId, budgetId);
  if (categories.length === 0) {
    throw new DomainError('Add a category before splitting the budget.');
  }

  const baseLimit = Math.floor(budget.amount_minor / categories.length);
  const remainder = budget.amount_minor - baseLimit * categories.length;
  await db.batch(
    categories.map((category, index) => {
      const limit = baseLimit + (index === 0 ? remainder : 0);
      return db
        .prepare(
          `UPDATE categories
           SET limit_minor = ?, limit_minor_optional = ?
           WHERE id = ? AND viewer_id = ?`,
        )
        .bind(limit, limit, category.id, viewerId);
    }),
  );

  if (budget.type === 'MONTHLY') {
    await db.batch(
      categories.map((category, index) => {
        const limit = baseLimit + (index === 0 ? remainder : 0);
        return db
          .prepare(
            `INSERT INTO category_period_limits (period_id, category_id, limit_minor)
             SELECT p.id, ?, ? FROM budget_periods p
             WHERE p.budget_id = ? AND p.viewer_id = ? AND p.period_start >= ?
             ON CONFLICT (period_id, category_id) DO UPDATE SET limit_minor = excluded.limit_minor`,
          )
          .bind(category.id, limit, budget.id, viewerId, monthStart());
      }),
    );
  }

  const updated = await getBudget(db, viewerId, budgetId);
  if (!updated) throw new Error('Updated budget could not be loaded.');
  return updated;
}
