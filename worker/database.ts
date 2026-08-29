import type {
  BudgetRow,
  BudgetType,
  CategoryRow,
  ExpenseImpact,
  ExpenseRow,
  ProfileRow,
} from './types';
import { convertMinorUnits, decimalRateToMicros, referenceRateMicros } from './money';
import { optionalSpendingPosition, spendingPosition } from './budget-math';

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS profiles (
    viewer_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    base_currency TEXT NOT NULL CHECK (length(base_currency) = 3),
    locale TEXT NOT NULL DEFAULT 'en-IN',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    viewer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'TEMPORARY')),
    reporting_currency TEXT NOT NULL CHECK (length(reporting_currency) = 3),
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    profile_rate_micros INTEGER NOT NULL CHECK (profile_rate_micros > 0),
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (viewer_id) REFERENCES profiles(viewer_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS budgets_viewer_status_idx
    ON budgets(viewer_id, status, start_date)`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    budget_id TEXT NOT NULL,
    viewer_id TEXT NOT NULL,
    name TEXT NOT NULL,
    limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (limit_minor >= 0),
    limit_minor_optional INTEGER CHECK (
      limit_minor_optional IS NULL OR limit_minor_optional > 0
    ),
    color TEXT NOT NULL DEFAULT '#2e7064',
    created_at TEXT NOT NULL,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (viewer_id) REFERENCES profiles(viewer_id) ON DELETE CASCADE,
    UNIQUE (budget_id, name)
  )`,
  `CREATE INDEX IF NOT EXISTS categories_budget_idx ON categories(budget_id)`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    viewer_id TEXT NOT NULL,
    budget_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    title TEXT NOT NULL,
    amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
    currency TEXT NOT NULL CHECK (length(currency) = 3),
    exchange_rate_micros INTEGER NOT NULL CHECK (exchange_rate_micros > 0),
    converted_amount_minor INTEGER NOT NULL CHECK (converted_amount_minor > 0),
    expense_date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (viewer_id) REFERENCES profiles(viewer_id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS expenses_viewer_date_idx
    ON expenses(viewer_id, expense_date DESC)`,
  `CREATE INDEX IF NOT EXISTS expenses_budget_idx
    ON expenses(budget_id, expense_date DESC)`,
];

const defaultCategoryColors = ['#2e7064', '#e8795d', '#d1a64c', '#6382a8', '#8774a8'];

function requireText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maxLength) throw new Error(`${label} is too long.`);
  return normalized;
}

function requireIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be a valid date.`);
  }
  return value;
}

export async function ensureDatabase(db: D1Database): Promise<void> {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
}

export async function ensureViewer(db: D1Database, viewerId: string): Promise<void> {
  const existing = await db
    .prepare('SELECT viewer_id FROM profiles WHERE viewer_id = ?')
    .bind(viewerId)
    .first<{ viewer_id: string }>();

  if (existing) return;

  const now = new Date().toISOString();
  const monthlyBudgetId = crypto.randomUUID();
  const tripBudgetId = crypto.randomUUID();
  const monthlyCategories = [
    { id: crypto.randomUUID(), name: 'Food', limit: 3_200_000, color: '#2e7064' },
    { id: crypto.randomUUID(), name: 'Housing', limit: 4_500_000, color: '#6382a8' },
    { id: crypto.randomUUID(), name: 'Utilities', limit: 1_500_000, color: '#d1a64c' },
    { id: crypto.randomUUID(), name: 'Leisure', limit: null, color: '#e8795d' },
  ];
  const tripCategories = [
    { id: crypto.randomUUID(), name: 'Transport', limit: 95_000, color: '#6382a8' },
    { id: crypto.randomUUID(), name: 'Stay', limit: 120_000, color: '#8774a8' },
    { id: crypto.randomUUID(), name: 'Food', limit: 70_000, color: '#e8795d' },
    { id: crypto.randomUUID(), name: 'Experiences', limit: null, color: '#d1a64c' },
  ];

  await db.batch([
    db
      .prepare(
        `INSERT INTO profiles (viewer_id, display_name, base_currency, locale, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(viewerId, 'Alex Morgan', 'INR', 'en-IN', now),
    db
      .prepare(
        `INSERT INTO budgets (
          id, viewer_id, name, type, reporting_currency, amount_minor,
          profile_rate_micros, start_date, end_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      )
      .bind(
        monthlyBudgetId,
        viewerId,
        'August monthly',
        'MONTHLY',
        'INR',
        12_000_000,
        1_000_000,
        '2026-08-01',
        null,
        now,
      ),
    db
      .prepare(
        `INSERT INTO budgets (
          id, viewer_id, name, type, reporting_currency, amount_minor,
          profile_rate_micros, start_date, end_date, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
      )
      .bind(
        tripBudgetId,
        viewerId,
        'Japan in autumn',
        'TEMPORARY',
        'JPY',
        320_000,
        referenceRateMicros('JPY', 'INR'),
        '2026-10-12',
        '2026-10-24',
        now,
      ),
    ...monthlyCategories.map((category) =>
      db
        .prepare(
          `INSERT INTO categories
           (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          category.id,
          monthlyBudgetId,
          viewerId,
          category.name,
          category.limit ?? 0,
          category.limit,
          category.color,
          now,
        ),
    ),
    ...tripCategories.map((category) =>
      db
        .prepare(
          `INSERT INTO categories
           (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          category.id,
          tripBudgetId,
          viewerId,
          category.name,
          category.limit ?? 0,
          category.limit,
          category.color,
          now,
        ),
    ),
  ]);

  const seededExpenses = [
    {
      budgetId: monthlyBudgetId,
      categoryId: monthlyCategories[0].id,
      title: 'Grocery basket',
      amountMinor: 284_000,
      currency: 'INR',
      converted: 284_000,
      date: '2026-08-28',
    },
    {
      budgetId: monthlyBudgetId,
      categoryId: monthlyCategories[1].id,
      title: 'August rent',
      amountMinor: 4_800_000,
      currency: 'INR',
      converted: 4_800_000,
      date: '2026-08-02',
    },
    {
      budgetId: monthlyBudgetId,
      categoryId: monthlyCategories[2].id,
      title: 'Electricity bill',
      amountMinor: 312_000,
      currency: 'INR',
      converted: 312_000,
      date: '2026-08-25',
    },
    {
      budgetId: monthlyBudgetId,
      categoryId: monthlyCategories[3].id,
      title: 'Weekend dinner',
      amountMinor: 195_000,
      currency: 'INR',
      converted: 195_000,
      date: '2026-08-23',
    },
    {
      budgetId: tripBudgetId,
      categoryId: tripCategories[0].id,
      title: 'Shinkansen tickets',
      amountMinor: 28_400,
      currency: 'JPY',
      converted: 28_400,
      date: '2026-08-27',
    },
    {
      budgetId: tripBudgetId,
      categoryId: tripCategories[1].id,
      title: 'Kyoto hotel deposit',
      amountMinor: 55_800,
      currency: 'JPY',
      converted: 55_800,
      date: '2026-08-20',
    },
  ];

  await db.batch(
    seededExpenses.map((expense) =>
      db
        .prepare(
          `INSERT INTO expenses (
            id, viewer_id, budget_id, category_id, title, amount_minor,
            currency, exchange_rate_micros, converted_amount_minor,
            expense_date, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          viewerId,
          expense.budgetId,
          expense.categoryId,
          expense.title,
          expense.amountMinor,
          expense.currency,
          1_000_000,
          expense.converted,
          expense.date,
          now,
        ),
    ),
  );
}

export async function getProfile(db: D1Database, viewerId: string): Promise<ProfileRow> {
  const profile = await db
    .prepare('SELECT * FROM profiles WHERE viewer_id = ?')
    .bind(viewerId)
    .first<ProfileRow>();

  if (!profile) throw new Error('Profile was not found.');
  return profile;
}

export async function viewerExists(db: D1Database, viewerId: string): Promise<boolean> {
  const profile = await db
    .prepare('SELECT viewer_id FROM profiles WHERE viewer_id = ?')
    .bind(viewerId)
    .first<{ viewer_id: string }>();
  return Boolean(profile);
}

export async function resetViewer(db: D1Database, viewerId: string): Promise<void> {
  await db.prepare('DELETE FROM profiles WHERE viewer_id = ?').bind(viewerId).run();
  await ensureViewer(db, viewerId);
}

export async function updateProfile(
  db: D1Database,
  viewerId: string,
  input: { displayName: string; baseCurrency: string; locale: string },
): Promise<ProfileRow> {
  const currency = input.baseCurrency.toUpperCase();
  const displayName = requireText(input.displayName, 'Display name', 60);
  if (!/^en-(IN|GB|US)$|^de-DE$/.test(input.locale)) {
    throw new Error('Choose a supported locale.');
  }
  referenceRateMicros(currency, 'INR');
  const budgets = await getBudgets(db, viewerId);

  await db.batch([
    db
      .prepare(
        `UPDATE profiles SET display_name = ?, base_currency = ?, locale = ?
         WHERE viewer_id = ?`,
      )
      .bind(displayName, currency, input.locale, viewerId),
    ...budgets.map((budget) =>
      db
        .prepare('UPDATE budgets SET profile_rate_micros = ? WHERE id = ? AND viewer_id = ?')
        .bind(referenceRateMicros(budget.reporting_currency, currency), budget.id, viewerId),
    ),
  ]);

  return getProfile(db, viewerId);
}

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

export async function createBudget(
  db: D1Database,
  viewerId: string,
  input: {
    name: string;
    type: BudgetType;
    reportingCurrency: string;
    amountMinor: string;
    startDate: string;
    endDate?: string | null;
  },
): Promise<BudgetRow> {
  const profile = await getProfile(db, viewerId);
  const amountMinor = Number(input.amountMinor);
  const reportingCurrency = input.reportingCurrency.toUpperCase();
  const name = requireText(input.name, 'Budget name', 60);
  const startDate = requireIsoDate(input.startDate, 'Start date');
  const endDate = input.endDate ? requireIsoDate(input.endDate, 'End date') : null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Budget amount must be a positive amount.');
  }
  if (input.type !== 'MONTHLY' && input.type !== 'TEMPORARY') {
    throw new Error('Choose a supported budget type.');
  }
  if (input.type === 'TEMPORARY' && !endDate) {
    throw new Error('Temporary budgets require an end date.');
  }
  if (endDate && endDate < startDate) {
    throw new Error('End date must be on or after the start date.');
  }

  await db
    .prepare(
      `INSERT INTO budgets (
        id, viewer_id, name, type, reporting_currency, amount_minor,
        profile_rate_micros, start_date, end_date, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    )
    .bind(
      id,
      viewerId,
      name,
      input.type,
      reportingCurrency,
      amountMinor,
      referenceRateMicros(reportingCurrency, profile.base_currency),
      startDate,
      endDate,
      now,
    )
    .run();

  const defaultCategories =
    input.type === 'MONTHLY'
      ? ['Food', 'Housing', 'Transport', 'Leisure']
      : ['Transport', 'Stay', 'Food', 'Experiences'];

  await db.batch(
    defaultCategories.map((name, index) =>
      db
        .prepare(
          `INSERT INTO categories
           (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), id, viewerId, name, 0, null, defaultCategoryColors[index], now),
    ),
  );

  const budget = await getBudget(db, viewerId, id);
  if (!budget) throw new Error('Created budget could not be loaded.');
  return budget;
}

export async function createCategory(
  db: D1Database,
  viewerId: string,
  input: { budgetId: string; name: string; limitMinor?: string | null; color: string },
): Promise<CategoryRow> {
  const budget = await getBudget(db, viewerId, input.budgetId);
  if (!budget) throw new Error('Budget was not found.');
  const name = requireText(input.name, 'Category name', 40);
  const limitMinor = input.limitMinor ? Number(input.limitMinor) : null;
  if (limitMinor !== null && (!Number.isSafeInteger(limitMinor) || limitMinor <= 0)) {
    throw new Error('Category limit must be a positive amount when provided.');
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO categories
       (id, budget_id, viewer_id, name, limit_minor, limit_minor_optional, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.budgetId, viewerId, name, limitMinor ?? 0, limitMinor, input.color, now)
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
  input: { categoryId: string; limitMinor?: string | null },
): Promise<CategoryRow> {
  const limitMinor = input.limitMinor ? Number(input.limitMinor) : null;
  if (limitMinor !== null && (!Number.isSafeInteger(limitMinor) || limitMinor <= 0)) {
    throw new Error('Category limit must be a positive amount when provided.');
  }

  const result = await db
    .prepare(
      `UPDATE categories
       SET limit_minor = ?, limit_minor_optional = ?
       WHERE id = ? AND viewer_id = ?`,
    )
    .bind(limitMinor ?? 0, limitMinor, input.categoryId, viewerId)
    .run();
  if (result.meta.changes !== 1) throw new Error('Category was not found.');

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
  if (!budget) throw new Error('Budget was not found.');
  const categories = await getCategories(db, viewerId, budgetId);
  if (categories.length === 0) throw new Error('Add a category before splitting the budget.');

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

export async function previewExpenseImpact(
  db: D1Database,
  viewerId: string,
  input: {
    budgetId: string;
    categoryId: string;
    amountMinor: string;
    currency: string;
    exchangeRate?: string | null;
  },
): Promise<ExpenseImpact> {
  const budget = await getBudget(db, viewerId, input.budgetId);
  if (!budget) throw new Error('Budget was not found.');
  const category = (await getCategories(db, viewerId, input.budgetId)).find(
    (candidate) => candidate.id === input.categoryId,
  );
  if (!category) throw new Error('Category does not belong to the selected budget.');

  const amountMinor = Number(input.amountMinor);
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('Expense amount must be a positive amount.');
  }

  const currency = input.currency.toUpperCase();
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
  input: {
    budgetId: string;
    categoryId: string;
    title: string;
    amountMinor: string;
    currency: string;
    exchangeRate?: string | null;
    expenseDate: string;
    notes?: string | null;
  },
): Promise<ExpenseRow> {
  const title = requireText(input.title, 'Expense description', 80);
  const expenseDate = requireIsoDate(input.expenseDate, 'Expense date');
  const amountMinor = Number(input.amountMinor);
  const currency = input.currency.toUpperCase();
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
      input.notes?.trim() || null,
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

export function availableInProfileCurrency(budgets: BudgetRow[], profileCurrency: string): number {
  return budgets.reduce((total, budget) => {
    const remaining = Math.max(0, budget.amount_minor - (budget.spent_minor ?? 0));
    return (
      total +
      convertMinorUnits(
        remaining,
        budget.reporting_currency,
        profileCurrency,
        budget.profile_rate_micros,
      )
    );
  }, 0);
}

export function overspentInProfileCurrency(budgets: BudgetRow[], profileCurrency: string): number {
  return budgets.reduce((total, budget) => {
    const overspent = Math.max(0, (budget.spent_minor ?? 0) - budget.amount_minor);
    return (
      total +
      convertMinorUnits(
        overspent,
        budget.reporting_currency,
        profileCurrency,
        budget.profile_rate_micros,
      )
    );
  }, 0);
}
