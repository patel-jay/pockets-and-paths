import type {
  BudgetRow,
  CategoryRow,
  CreateCategoryInput,
  UpdateCategoryLimitInput,
} from '../types';
import { DomainError } from '../errors';
import { getBudget } from './budgets';
import { optionalPositiveMinor, requireColor, requireText } from './validation';

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
  const name = requireText(input.name, 'Category name', 40);
  const limitMinor = optionalPositiveMinor(input.limitMinor, 'Category limit');
  const color = requireColor(input.color);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO categories
       (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.budgetId, viewerId, name, limitMinor ?? 0, limitMinor, color, now)
    .run();

  const category = await db
    .prepare('SELECT *, 0 AS spent_minor FROM categories WHERE id = ? AND viewer_id = ?')
    .bind(id, viewerId)
    .first<CategoryRow>();
  if (!category) throw new Error('Created category could not be loaded.');
  return category;
}

export async function updateCategoryLimit(
  db: D1Database,
  viewerId: string,
  input: UpdateCategoryLimitInput,
): Promise<CategoryRow> {
  const limitMinor = optionalPositiveMinor(input.limitMinor, 'Category limit');
  const result = await db
    .prepare(
      `UPDATE categories
       SET limit_minor = ?, limit_minor_optional = ?
       WHERE id = ? AND viewer_id = ?`,
    )
    .bind(limitMinor ?? 0, limitMinor, input.categoryId, viewerId)
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
