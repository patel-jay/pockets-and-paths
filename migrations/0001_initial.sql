CREATE TABLE IF NOT EXISTS profiles (
  viewer_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  base_currency TEXT NOT NULL CHECK (length(base_currency) = 3),
  locale TEXT NOT NULL DEFAULT 'en-IN',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
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
);

CREATE INDEX IF NOT EXISTS budgets_viewer_status_idx
  ON budgets(viewer_id, status, start_date);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  limit_minor INTEGER NOT NULL DEFAULT 0 CHECK (limit_minor >= 0),
  color TEXT NOT NULL DEFAULT '#2e7064',
  created_at TEXT NOT NULL,
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_id) REFERENCES profiles(viewer_id) ON DELETE CASCADE,
  UNIQUE (budget_id, name)
);

CREATE INDEX IF NOT EXISTS categories_budget_idx ON categories(budget_id);

CREATE TABLE IF NOT EXISTS expenses (
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
);

CREATE INDEX IF NOT EXISTS expenses_viewer_date_idx
  ON expenses(viewer_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_budget_idx ON expenses(budget_id, expense_date DESC);
