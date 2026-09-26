-- Keep zero-spend months visible in reports by creating monthly plan snapshots
-- through the end of the relevant calendar year.
WITH RECURSIVE period_seed AS (
  SELECT
    b.id AS budget_id,
    b.viewer_id,
    substr(b.start_date, 1, 7) || '-01' AS period_start,
    b.amount_minor,
    CASE
      WHEN substr(b.start_date, 1, 4) > strftime('%Y', 'now')
        THEN substr(b.start_date, 1, 4) || '-12-01'
      ELSE strftime('%Y', 'now') || '-12-01'
    END AS period_end,
    b.created_at
  FROM budgets b
  WHERE b.type = 'MONTHLY' AND b.status = 'ACTIVE'

  UNION ALL

  SELECT
    budget_id,
    viewer_id,
    date(period_start, '+1 month'),
    amount_minor,
    period_end,
    created_at
  FROM period_seed
  WHERE period_start < period_end
)
INSERT OR IGNORE INTO budget_periods
  (id, budget_id, viewer_id, period_start, amount_minor, created_at)
SELECT
  lower(hex(randomblob(16))),
  budget_id,
  viewer_id,
  period_start,
  amount_minor,
  created_at
FROM period_seed;

INSERT OR IGNORE INTO category_period_limits (period_id, category_id, limit_minor)
SELECT p.id, c.id, c.limit_minor_optional
FROM budget_periods p
JOIN categories c
  ON c.budget_id = p.budget_id AND c.viewer_id = p.viewer_id;
