export async function exportViewerData(db: D1Database, viewerId: string) {
  const [profile, budgets, budgetPeriods, categories, categoryPeriodLimits, expenses, refunds] =
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
      db
        .prepare(
          `SELECT r.*, e.title AS expense_title, e.currency,
                  b.name AS budget_name, c.name AS category_name
           FROM refunds r
           INNER JOIN expenses e ON e.id = r.expense_id AND e.viewer_id = r.viewer_id
           INNER JOIN budgets b ON b.id = e.budget_id
           INNER JOIN categories c ON c.id = e.category_id
           WHERE r.viewer_id = ?
           ORDER BY r.refund_date ASC, r.created_at ASC`,
        )
        .bind(viewerId)
        .all(),
    ]);
  return {
    formatVersion: 2,
    exportedAt: new Date().toISOString(),
    profile,
    budgets: budgets.results,
    budgetPeriods: budgetPeriods.results,
    categories: categories.results,
    categoryPeriodLimits: categoryPeriodLimits.results,
    expenses: expenses.results,
    refunds: refunds.results,
  };
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function expensesCsv(
  expenses: Record<string, unknown>[],
  refunds: Record<string, unknown>[] = [],
): string {
  const columns = [
    'transaction_type',
    'transaction_date',
    'title',
    'amount_minor',
    'currency',
    'budget_name',
    'category_name',
    'original_expense_id',
    'notes',
    'created_at',
  ];
  const rows = [
    ...expenses.map((expense) => ({
      transaction_type: 'EXPENSE',
      transaction_date: expense.expense_date,
      title: expense.title,
      amount_minor: expense.amount_minor,
      currency: expense.currency,
      budget_name: expense.budget_name,
      category_name: expense.category_name,
      original_expense_id: expense.id,
      notes: expense.notes,
      created_at: expense.created_at,
    })),
    ...refunds.map((refund) => ({
      transaction_type: 'REFUND',
      transaction_date: refund.refund_date,
      title: `Refund · ${String(refund.expense_title ?? 'Expense')}`,
      amount_minor: -Number(refund.amount_minor),
      currency: refund.currency,
      budget_name: refund.budget_name,
      category_name: refund.category_name,
      original_expense_id: refund.expense_id,
      notes: refund.notes,
      created_at: refund.created_at,
    })),
  ].sort(
    (left, right) =>
      String(left.transaction_date).localeCompare(String(right.transaction_date)) ||
      String(left.created_at).localeCompare(String(right.created_at)),
  );
  return [
    columns.join(','),
    ...rows.map((row) =>
      columns.map((column) => csvCell(row[column as keyof typeof row])).join(','),
    ),
  ].join('\r\n');
}
