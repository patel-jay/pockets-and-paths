export async function exportViewerData(db: D1Database, viewerId: string) {
  const [profile, budgets, budgetPeriods, categories, categoryPeriodLimits, expenses] =
    await Promise.all([
      db.prepare('SELECT * FROM profiles WHERE viewer_id = ?').bind(viewerId).first(),
      db
        .prepare('SELECT * FROM budgets WHERE viewer_id = ? ORDER BY created_at ASC')
        .bind(viewerId)
        .all(),
      db
        .prepare('SELECT * FROM budget_periods WHERE viewer_id = ? ORDER BY period_start ASC')
        .bind(viewerId)
        .all(),
      db
        .prepare('SELECT * FROM categories WHERE viewer_id = ? ORDER BY created_at ASC')
        .bind(viewerId)
        .all(),
      db
        .prepare(
          `SELECT cpl.* FROM category_period_limits cpl
         INNER JOIN budget_periods p ON p.id = cpl.period_id
         WHERE p.viewer_id = ?
         ORDER BY p.period_start ASC, cpl.category_id ASC`,
        )
        .bind(viewerId)
        .all(),
      db
        .prepare(
          `SELECT e.*, b.name AS budget_name, c.name AS category_name
         FROM expenses e
         INNER JOIN budgets b ON b.id = e.budget_id
         INNER JOIN categories c ON c.id = e.category_id
         WHERE e.viewer_id = ?
         ORDER BY e.expense_date ASC, e.created_at ASC`,
        )
        .bind(viewerId)
        .all(),
    ]);
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    profile,
    budgets: budgets.results,
    budgetPeriods: budgetPeriods.results,
    categories: categories.results,
    categoryPeriodLimits: categoryPeriodLimits.results,
    expenses: expenses.results,
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function expensesCsv(expenses: Record<string, unknown>[]): string {
  const columns = [
    'expense_date',
    'title',
    'amount_minor',
    'currency',
    'budget_name',
    'category_name',
    'notes',
    'created_at',
  ];
  return [
    columns.join(','),
    ...expenses.map((expense) => columns.map((column) => csvCell(expense[column])).join(',')),
  ].join('\r\n');
}
