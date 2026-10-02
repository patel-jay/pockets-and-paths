CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  viewer_id TEXT NOT NULL,
  expense_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  refund_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (viewer_id) REFERENCES profiles(viewer_id) ON DELETE CASCADE,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS refunds_expense_date_idx
  ON refunds(expense_id, refund_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS refunds_viewer_date_idx
  ON refunds(viewer_id, refund_date DESC, created_at DESC);
