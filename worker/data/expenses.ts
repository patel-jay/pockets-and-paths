import { DomainError } from '../errors';
import type {
  AddExpenseInput,
  BudgetStatus,
  ExpenseImpact,
  ExpenseImpactInput,
  ExpenseRow,
} from '../types';
import { optionalSpendingPosition, spendingPosition } from '../budget-math';
import { getBudget, requireActiveBudget } from './budgets';
import { getCategories } from './categories';
import { optionalText, requireIsoDate, requirePositiveMinor, requireText } from './validation';

export async function getExpenses(
  db: D1Database,
  viewerId: string,
  options: { budgetId?: string; budgetStatus?: BudgetStatus; limit?: number } = {},
): Promise<ExpenseRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const conditions = ['e.viewer_id = ?'];
  const bindings: (string | number)[] = [viewerId];
  if (options.budgetId) {
    conditions.push('e.budget_id = ?');
    bindings.push(options.budgetId);
  }
  if (options.budgetStatus) {
    conditions.push('b.status = ?');
    bindings.push(options.budgetStatus);
  }
  bindings.push(limit);
  const { results } = await db
    .prepare(
      `SELECT e.*, b.name AS budget_name, b.reporting_currency AS budget_currency,
              c.name AS category_name, c.color AS category_color, c.icon_key AS category_icon
       FROM expenses e
       INNER JOIN budgets b ON b.id = e.budget_id
       INNER JOIN categories c ON c.id = e.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT ?`,
    )
    .bind(...bindings)
    .all<ExpenseRow>();

  return results;
}

export async function previewExpenseImpact(
  db: D1Database,
  viewerId: string,
  input: ExpenseImpactInput,
): Promise<ExpenseImpact> {
  const budget = await getBudget(db, viewerId, input.budgetId);
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(budget);
  const category = (await getCategories(db, viewerId, input.budgetId)).find(
    (candidate) => candidate.id === input.categoryId,
  );
  if (!category) {
    throw new DomainError('Category does not belong to the selected budget.', 'FORBIDDEN');
  }

  const amountMinor = requirePositiveMinor(input.amountMinor, 'Expense amount');
  const budgetProjectedSpentMinor = (budget.spent_minor ?? 0) + amountMinor;
  const categoryProjectedSpentMinor = (category.spent_minor ?? 0) + amountMinor;
  const budgetPosition = spendingPosition(budgetProjectedSpentMinor, budget.amount_minor);
  const categoryPosition = optionalSpendingPosition(
    categoryProjectedSpentMinor,
    category.limit_minor_optional,
  );

  return {
    budgetCurrency: budget.reporting_currency,
    budgetProjectedSpentMinor,
    budgetOverspentMinor: budgetPosition.overspent,
    categoryName: category.name,
    categoryHasLimit: category.limit_minor_optional !== null,
    categoryProjectedSpentMinor,
    categoryOverspentMinor: categoryPosition?.overspent ?? 0,
  };
}

export async function createExpense(
  db: D1Database,
  viewerId: string,
  input: AddExpenseInput,
): Promise<ExpenseRow> {
  const title = requireText(input.title, 'Expense description', 80);
  const expenseDate = requireIsoDate(input.expenseDate, 'Expense date');
  const amountMinor = requirePositiveMinor(input.amountMinor, 'Expense amount');
  const notes = optionalText(input.notes, 'Notes', 300);
  const impact = await previewExpenseImpact(db, viewerId, input);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO expenses (
        id, viewer_id, budget_id, category_id, title, amount_minor,
        currency, exchange_rate_micros, converted_amount_minor,
        expense_date, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      viewerId,
      input.budgetId,
      input.categoryId,
      title,
      amountMinor,
      impact.budgetCurrency,
      1_000_000,
      amountMinor,
      expenseDate,
      notes,
      now,
    )
    .run();

  const expense = await db
    .prepare(
      `SELECT e.*, b.name AS budget_name, b.reporting_currency AS budget_currency,
              c.name AS category_name, c.color AS category_color, c.icon_key AS category_icon
       FROM expenses e
       INNER JOIN budgets b ON b.id = e.budget_id
       INNER JOIN categories c ON c.id = e.category_id
       WHERE e.id = ? AND e.viewer_id = ?`,
    )
    .bind(id, viewerId)
    .first<ExpenseRow>();
  if (!expense) throw new Error('Created expense could not be loaded.');
  return expense;
}
