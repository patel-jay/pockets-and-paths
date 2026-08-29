import { convertMinorUnits, decimalRateToMicros, referenceRateMicros } from '../money';
import { DomainError } from '../errors';
import type { AddExpenseInput, ExpenseImpact, ExpenseImpactInput, ExpenseRow } from '../types';
import { optionalSpendingPosition, spendingPosition } from '../budget-math';
import { getBudget } from './budgets';
import { getCategories } from './categories';
import {
  optionalText,
  requireCurrency,
  requireIsoDate,
  requirePositiveMinor,
  requireText,
} from './validation';

export async function getExpenses(
  db: D1Database,
  viewerId: string,
  options: { budgetId?: string; limit?: number } = {},
): Promise<ExpenseRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const budgetClause = options.budgetId ? 'AND e.budget_id = ?' : '';
  const bindings = options.budgetId ? [viewerId, options.budgetId, limit] : [viewerId, limit];
  const { results } = await db
    .prepare(
      `SELECT e.*, b.name AS budget_name, b.reporting_currency AS budget_currency,
              c.name AS category_name
       FROM expenses e
       INNER JOIN budgets b ON b.id = e.budget_id
       INNER JOIN categories c ON c.id = e.category_id
       WHERE e.viewer_id = ? ${budgetClause}
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
  const category = (await getCategories(db, viewerId, input.budgetId)).find(
    (candidate) => candidate.id === input.categoryId,
  );
  if (!category) {
    throw new DomainError('Category does not belong to the selected budget.', 'FORBIDDEN');
  }

  const amountMinor = requirePositiveMinor(input.amountMinor, 'Expense amount');
  const currency = requireCurrency(input.currency);
  const rateMicros = input.exchangeRate
    ? decimalRateToMicros(input.exchangeRate)
    : referenceRateMicros(currency, budget.reporting_currency);
  const convertedAmountMinor = convertMinorUnits(
    amountMinor,
    currency,
    budget.reporting_currency,
    rateMicros,
  );

  const budgetProjectedSpentMinor = (budget.spent_minor ?? 0) + convertedAmountMinor;
  const categoryProjectedSpentMinor = (category.spent_minor ?? 0) + convertedAmountMinor;
  const budgetPosition = spendingPosition(budgetProjectedSpentMinor, budget.amount_minor);
  const categoryPosition = optionalSpendingPosition(
    categoryProjectedSpentMinor,
    category.limit_minor_optional,
  );

  return {
    convertedAmountMinor,
    exchangeRateMicros: rateMicros,
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
  const currency = requireCurrency(input.currency);
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
      currency,
      impact.exchangeRateMicros,
      impact.convertedAmountMinor,
      expenseDate,
      notes,
      now,
    )
    .run();

  const expense = await db
    .prepare(
      `SELECT e.*, b.name AS budget_name, b.reporting_currency AS budget_currency,
              c.name AS category_name
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
