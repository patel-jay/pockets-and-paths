import { DomainError } from '../errors';
import type {
  AddExpenseInput,
  BudgetStatus,
  ExpenseFilterInput,
  ExpenseImpact,
  ExpenseImpactInput,
  ExpenseRow,
  UpdateExpenseInput,
} from '../types';
import { optionalSpendingPosition, spendingPosition } from '../budget-math';
import { getBudget, requireActiveBudget } from './budgets';
import { getCategories } from './categories';
import { ensureBudgetPeriod, monthStart, validateExpenseDateForBudget } from './periods';
import { optionalText, requireIsoDate, requirePositiveMinor, requireText } from './validation';

const expenseSelect = `SELECT e.*, b.name AS budget_name,
  b.reporting_currency AS budget_currency, b.status AS budget_status, c.name AS category_name,
  c.color AS category_color, c.icon_key AS category_icon,
  p.period_start
  FROM expenses e
  INNER JOIN budgets b ON b.id = e.budget_id
  INNER JOIN categories c ON c.id = e.category_id
  LEFT JOIN budget_periods p ON p.id = e.period_id`;

export async function getExpense(
  db: D1Database,
  viewerId: string,
  expenseId: string,
): Promise<ExpenseRow | null> {
  return db
    .prepare(`${expenseSelect} WHERE e.id = ? AND e.viewer_id = ?`)
    .bind(expenseId, viewerId)
    .first<ExpenseRow>();
}

export async function getExpenses(
  db: D1Database,
  viewerId: string,
  options: {
    budgetId?: string;
    budgetStatus?: BudgetStatus;
    limit?: number;
    periodId?: string | null;
    periodScoped?: boolean;
  } = {},
): Promise<ExpenseRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const conditions = ['e.viewer_id = ?'];
  const bindings: (string | number | null)[] = [viewerId];
  if (options.budgetId) {
    conditions.push('e.budget_id = ?');
    bindings.push(options.budgetId);
  }
  if (options.budgetStatus) {
    conditions.push('b.status = ?');
    bindings.push(options.budgetStatus);
  }
  if (options.periodScoped) {
    if (options.periodId) {
      conditions.push('e.period_id = ?');
      bindings.push(options.periodId);
    } else {
      conditions.push('1 = 0');
    }
  }
  bindings.push(limit);
  const { results } = await db
    .prepare(
      `${expenseSelect}
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.expense_date DESC, e.created_at DESC, e.id DESC
       LIMIT ?`,
    )
    .bind(...bindings)
    .all<ExpenseRow>();
  return results;
}

type ExpenseCursor = { date: string; createdAt: string; id: string };

function encodeCursor(expense: ExpenseRow): string {
  return btoa(
    JSON.stringify({ date: expense.expense_date, createdAt: expense.created_at, id: expense.id }),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function decodeCursor(value: string | null | undefined): ExpenseCursor | null {
  if (!value || value.length > 500) return null;
  try {
    const unpadded = value.replaceAll('-', '+').replaceAll('_', '/');
    const normalized = unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, '=');
    const cursor = JSON.parse(atob(normalized)) as Partial<ExpenseCursor>;
    if (
      typeof cursor.date !== 'string' ||
      typeof cursor.createdAt !== 'string' ||
      typeof cursor.id !== 'string'
    ) {
      throw new Error('Malformed cursor');
    }
    return cursor as ExpenseCursor;
  } catch {
    throw new DomainError('The expense page cursor is invalid.');
  }
}

export async function getExpensePage(
  db: D1Database,
  viewerId: string,
  filter: ExpenseFilterInput = {},
  first = 25,
  after?: string | null,
): Promise<{ items: ExpenseRow[]; nextCursor: string | null }> {
  const pageSize = Math.min(Math.max(first, 1), 50);
  const conditions = ['e.viewer_id = ?'];
  const bindings: (string | number)[] = [viewerId];

  if (filter.budgetId) {
    conditions.push('e.budget_id = ?');
    bindings.push(filter.budgetId);
  }
  if (filter.categoryId) {
    conditions.push('e.category_id = ?');
    bindings.push(filter.categoryId);
  }
  if (filter.dateFrom) {
    conditions.push('e.expense_date >= ?');
    bindings.push(requireIsoDate(filter.dateFrom, 'From date'));
  }
  if (filter.dateTo) {
    conditions.push('e.expense_date <= ?');
    bindings.push(requireIsoDate(filter.dateTo, 'To date'));
  }
  if (filter.dateFrom && filter.dateTo && filter.dateFrom > filter.dateTo) {
    throw new DomainError('The from date must be on or before the to date.');
  }
  const search = optionalText(filter.search, 'Search', 80);
  if (search) {
    conditions.push("instr(lower(e.title || ' ' || COALESCE(e.notes, '')), lower(?)) > 0");
    bindings.push(search);
  }

  const cursor = decodeCursor(after);
  if (cursor) {
    conditions.push(`(
      e.expense_date < ? OR
      (e.expense_date = ? AND e.created_at < ?) OR
      (e.expense_date = ? AND e.created_at = ? AND e.id < ?)
    )`);
    bindings.push(
      cursor.date,
      cursor.date,
      cursor.createdAt,
      cursor.date,
      cursor.createdAt,
      cursor.id,
    );
  }

  bindings.push(pageSize + 1);
  const { results } = await db
    .prepare(
      `${expenseSelect}
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.expense_date DESC, e.created_at DESC, e.id DESC
       LIMIT ?`,
    )
    .bind(...bindings)
    .all<ExpenseRow>();
  const hasNextPage = results.length > pageSize;
  const items = hasNextPage ? results.slice(0, pageSize) : results;
  return {
    items,
    nextCursor: hasNextPage && items.length ? encodeCursor(items.at(-1)!) : null,
  };
}

export async function previewExpenseImpact(
  db: D1Database,
  viewerId: string,
  input: ExpenseImpactInput,
): Promise<ExpenseImpact> {
  const expenseDate = requireIsoDate(input.expenseDate, 'Expense date');
  const budget = await getBudget(db, viewerId, input.budgetId, monthStart(expenseDate));
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(budget);
  validateExpenseDateForBudget(budget, expenseDate);
  const categories = await getCategories(db, viewerId, input.budgetId, {
    periodId: budget.period_id,
    periodScoped: budget.type === 'MONTHLY',
  });
  const category = categories.find((candidate) => candidate.id === input.categoryId);
  if (!category) {
    throw new DomainError('Category does not belong to the selected budget.', 'FORBIDDEN');
  }

  let budgetSpentMinor = budget.spent_minor ?? 0;
  let categorySpentMinor = category.spent_minor ?? 0;
  if (input.excludeExpenseId) {
    const existing = await getExpense(db, viewerId, input.excludeExpenseId);
    if (!existing) throw new DomainError('Expense was not found.', 'NOT_FOUND');
    const samePeriod =
      budget.type === 'TEMPORARY' || existing.period_start === monthStart(expenseDate);
    if (existing.budget_id === input.budgetId && samePeriod) {
      budgetSpentMinor -= existing.converted_amount_minor;
      if (existing.category_id === input.categoryId) {
        categorySpentMinor -= existing.converted_amount_minor;
      }
    }
  }

  const amountMinor = requirePositiveMinor(input.amountMinor, 'Expense amount');
  const budgetProjectedSpentMinor = budgetSpentMinor + amountMinor;
  const categoryProjectedSpentMinor = categorySpentMinor + amountMinor;
  const budgetAmountMinor = budget.period_amount_minor ?? budget.amount_minor;
  const budgetPosition = spendingPosition(budgetProjectedSpentMinor, budgetAmountMinor);
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

function normalizedExpenseInput(input: AddExpenseInput) {
  return {
    title: requireText(input.title, 'Expense description', 80),
    expenseDate: requireIsoDate(input.expenseDate, 'Expense date'),
    amountMinor: requirePositiveMinor(input.amountMinor, 'Expense amount'),
    notes: optionalText(input.notes, 'Notes', 300),
  };
}

export async function createExpense(
  db: D1Database,
  viewerId: string,
  input: AddExpenseInput,
): Promise<ExpenseRow> {
  const normalized = normalizedExpenseInput(input);
  const impact = await previewExpenseImpact(db, viewerId, input);
  const budget = await getBudget(db, viewerId, input.budgetId, normalized.expenseDate);
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  const periodId = await ensureBudgetPeriod(db, viewerId, budget, normalized.expenseDate);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO expenses (
        id, viewer_id, budget_id, category_id, title, amount_minor,
        currency, exchange_rate_micros, converted_amount_minor,
        expense_date, notes, created_at, period_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      viewerId,
      input.budgetId,
      input.categoryId,
      normalized.title,
      normalized.amountMinor,
      impact.budgetCurrency,
      1_000_000,
      normalized.amountMinor,
      normalized.expenseDate,
      normalized.notes,
      now,
      periodId,
    )
    .run();

  const expense = await getExpense(db, viewerId, id);
  if (!expense) throw new Error('Created expense could not be loaded.');
  return expense;
}

export async function updateExpense(
  db: D1Database,
  viewerId: string,
  input: UpdateExpenseInput,
): Promise<ExpenseRow> {
  const existing = await getExpense(db, viewerId, input.expenseId);
  if (!existing) {
    throw new DomainError('Expense was not found.', 'NOT_FOUND');
  }
  const existingBudget = await getBudget(db, viewerId, existing.budget_id, existing.expense_date);
  if (!existingBudget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(existingBudget);
  const normalized = normalizedExpenseInput(input);
  const impact = await previewExpenseImpact(db, viewerId, {
    ...input,
    excludeExpenseId: input.expenseId,
  });
  const budget = await getBudget(db, viewerId, input.budgetId, normalized.expenseDate);
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  const periodId = await ensureBudgetPeriod(db, viewerId, budget, normalized.expenseDate);
  const result = await db
    .prepare(
      `UPDATE expenses SET budget_id = ?, category_id = ?, title = ?, amount_minor = ?,
         currency = ?, converted_amount_minor = ?, expense_date = ?, notes = ?, period_id = ?
       WHERE id = ? AND viewer_id = ?`,
    )
    .bind(
      input.budgetId,
      input.categoryId,
      normalized.title,
      normalized.amountMinor,
      impact.budgetCurrency,
      normalized.amountMinor,
      normalized.expenseDate,
      normalized.notes,
      periodId,
      input.expenseId,
      viewerId,
    )
    .run();
  if (result.meta.changes !== 1) throw new DomainError('Expense was not found.', 'NOT_FOUND');
  const expense = await getExpense(db, viewerId, input.expenseId);
  if (!expense) throw new Error('Updated expense could not be loaded.');
  return expense;
}

export async function deleteExpense(
  db: D1Database,
  viewerId: string,
  expenseId: string,
): Promise<boolean> {
  const expense = await getExpense(db, viewerId, expenseId);
  if (!expense) throw new DomainError('Expense was not found.', 'NOT_FOUND');
  const budget = await getBudget(db, viewerId, expense.budget_id, expense.expense_date);
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(budget);
  const result = await db
    .prepare('DELETE FROM expenses WHERE id = ? AND viewer_id = ?')
    .bind(expenseId, viewerId)
    .run();
  return result.meta.changes === 1;
}
