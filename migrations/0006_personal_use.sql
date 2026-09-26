CREATE TABLE IF NOT EXISTS budget_periods (
  id TEXT PRIMARY KEY,
  budget_id TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_id) REFERENCES profiles(viewer_id) ON DELETE CASCADE,
  UNIQUE (budget_id, period_start)
);

CREATE INDEX IF NOT EXISTS budget_periods_viewer_date_idx
  ON budget_periods(viewer_id, period_start DESC);

CREATE TABLE IF NOT EXISTS category_period_limits (
  period_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  limit_minor INTEGER CHECK (limit_minor IS NULL OR limit_minor > 0),
  PRIMARY KEY (period_id, category_id),
  FOREIGN KEY (period_id) REFERENCES budget_periods(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

ALTER TABLE expenses ADD COLUMN period_id TEXT REFERENCES budget_periods(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS expenses_period_date_idx
  ON expenses(period_id, expense_date DESC, created_at DESC);

INSERT OR IGNORE INTO budget_periods (
  id, budget_id, viewer_id, period_start, amount_minor, created_at
)
SELECT
  lower(hex(randomblob(16))),
  b.id,
  b.viewer_id,
  substr(e.expense_date, 1, 7) || '-01',
  b.amount_minor,
  MIN(e.created_at)
FROM budgets b
INNER JOIN expenses e ON e.budget_id = b.id AND e.viewer_id = b.viewer_id
WHERE b.type = 'MONTHLY'
GROUP BY b.id, substr(e.expense_date, 1, 7);

UPDATE expenses
SET period_id = (
  SELECT p.id
  FROM budget_periods p
  WHERE p.budget_id = expenses.budget_id
    AND p.period_start = substr(expenses.expense_date, 1, 7) || '-01'
)
WHERE period_id IS NULL
  AND EXISTS (
    SELECT 1 FROM budgets b WHERE b.id = expenses.budget_id AND b.type = 'MONTHLY'
  );

INSERT OR IGNORE INTO category_period_limits (period_id, category_id, limit_minor)
SELECT p.id, c.id, c.limit_minor_optional
FROM budget_periods p
INNER JOIN categories c ON c.budget_id = p.budget_id AND c.viewer_id = p.viewer_id;

ALTER TABLE account_sessions ADD COLUMN user_agent TEXT;
