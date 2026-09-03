import type { BudgetRow, CategoryRow, CreateCategoryInput, UpdateCategoryInput } from '../types';
import { DomainError } from '../errors';
import { getBudget, requireActiveBudget } from './budgets';
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
): Promise<CategoryRow[]> {
  const { results } = await db
    .prepare(
      `SELECT c.*, COALESCE(SUM(e.converted_amount_minor), 0) AS spent_minor
       FROM categories c
       LEFT JOIN expenses e ON e.category_id = c.id AND e.viewer_id = c.viewer_id
       WHERE c.viewer_id = ? AND c.budget_id = ?
       GROUP BY c.id
       ORDER BY c.created_at ASC`,
    )
    .bind(viewerId, budgetId)
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

  const updated = await getBudget(db, viewerId, budgetId);
  if (!updated) throw new Error('Updated budget could not be loaded.');
  return updated;
}
