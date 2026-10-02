import { DomainError } from '../errors';
import type { CreateRefundInput, RefundRow, UpdateRefundInput } from '../types';
import { getBudget, requireActiveBudget } from './budgets';
import { getExpense } from './expense-ledger';
import { optionalText, requireIsoDate, requirePositiveMinor } from './validation';

const refundSelect = `SELECT r.*, e.expense_date, e.title AS expense_title,
  e.budget_id, b.status AS budget_status, b.reporting_currency AS budget_currency
  FROM refunds r
  INNER JOIN expenses e ON e.id = r.expense_id AND e.viewer_id = r.viewer_id
  INNER JOIN budgets b ON b.id = e.budget_id AND b.viewer_id = r.viewer_id`;

export async function getRefund(
  db: D1Database,
  viewerId: string,
  refundId: string,
): Promise<RefundRow | null> {
  return db
    .prepare(`${refundSelect} WHERE r.id = ? AND r.viewer_id = ?`)
    .bind(refundId, viewerId)
    .first<RefundRow>();
}

export async function getRefunds(
  db: D1Database,
  viewerId: string,
  expenseId: string,
): Promise<RefundRow[]> {
  const { results } = await db
    .prepare(
      `${refundSelect}
       WHERE r.expense_id = ? AND r.viewer_id = ?
       ORDER BY r.refund_date DESC, r.created_at DESC, r.id DESC`,
    )
    .bind(expenseId, viewerId)
    .all<RefundRow>();
  return results;
}

function normalizeRefundDetails(
  expenseDate: string,
  refundDateValue: string,
  notesValue?: string | null,
) {
  const refundDate = requireIsoDate(refundDateValue, 'Refund date');
  if (refundDate < expenseDate) {
    throw new DomainError('The refund date cannot be before the original expense date.');
  }
  if (refundDate > new Date().toISOString().slice(0, 10)) {
    throw new DomainError(
      'Record the refund after it is received; the date cannot be in the future.',
    );
  }
  return {
    refundDate,
    notes: optionalText(notesValue, 'Notes', 300),
  };
}

async function requireEditableExpense(db: D1Database, viewerId: string, expenseId: string) {
  const expense = await getExpense(db, viewerId, expenseId);
  if (!expense) throw new DomainError('Expense was not found.', 'NOT_FOUND');
  const budget = await getBudget(db, viewerId, expense.budget_id, expense.expense_date);
  if (!budget) throw new DomainError('Budget was not found.', 'NOT_FOUND');
  requireActiveBudget(budget);
  return expense;
}

export async function createRefund(
  db: D1Database,
  viewerId: string,
  input: CreateRefundInput,
): Promise<RefundRow> {
  if (input.kind !== 'FULL' && input.kind !== 'PARTIAL') {
    throw new DomainError('Choose a full or partial refund.');
  }
  const expense = await requireEditableExpense(db, viewerId, input.expenseId);
  const details = normalizeRefundDetails(expense.expense_date, input.refundDate, input.notes);
  const remainingMinor = expense.converted_amount_minor - (expense.refunded_minor ?? 0);
  if (remainingMinor <= 0) throw new DomainError('This expense has already been fully refunded.');

  const amountMinor =
    input.kind === 'FULL'
      ? remainingMinor
      : requirePositiveMinor(input.amountMinor ?? '', 'Refund amount');
  if (amountMinor > remainingMinor) {
    throw new DomainError('The refund cannot exceed the remaining refundable amount.');
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO refunds
         (id, viewer_id, expense_id, amount_minor, refund_date, notes, created_at)
       SELECT ?, ?, e.id, ?, ?, ?, ?
       FROM expenses e
       WHERE e.id = ? AND e.viewer_id = ?
         AND ? <= e.converted_amount_minor - COALESCE((
           SELECT SUM(r.amount_minor) FROM refunds r
           WHERE r.expense_id = e.id AND r.viewer_id = e.viewer_id
         ), 0)`,
    )
    .bind(
      id,
      viewerId,
      amountMinor,
      details.refundDate,
      details.notes,
      now,
      input.expenseId,
      viewerId,
      amountMinor,
    )
    .run();
  if (result.meta.changes !== 1) {
    throw new DomainError('The refundable amount changed. Review the expense and try again.');
  }

  const refund = await getRefund(db, viewerId, id);
  if (!refund) throw new Error('Created refund could not be loaded.');
  return refund;
}

export async function updateRefund(
  db: D1Database,
  viewerId: string,
  input: UpdateRefundInput,
): Promise<RefundRow> {
  const existing = await getRefund(db, viewerId, input.refundId);
  if (!existing) throw new DomainError('Refund was not found.', 'NOT_FOUND');
  const expense = await requireEditableExpense(db, viewerId, existing.expense_id);
  const details = normalizeRefundDetails(expense.expense_date, input.refundDate, input.notes);
  const amountMinor = requirePositiveMinor(input.amountMinor, 'Refund amount');

  const result = await db
    .prepare(
      `UPDATE refunds
       SET amount_minor = ?, refund_date = ?, notes = ?
       WHERE id = ? AND viewer_id = ?
         AND ? <= (
           SELECT e.converted_amount_minor - COALESCE(SUM(other.amount_minor), 0)
           FROM expenses e
           LEFT JOIN refunds other
             ON other.expense_id = e.id AND other.viewer_id = e.viewer_id AND other.id <> ?
           WHERE e.id = refunds.expense_id AND e.viewer_id = refunds.viewer_id
           GROUP BY e.id
         )`,
    )
    .bind(
      amountMinor,
      details.refundDate,
      details.notes,
      input.refundId,
      viewerId,
      amountMinor,
      input.refundId,
    )
    .run();
  if (result.meta.changes !== 1) {
    throw new DomainError('The refund cannot exceed the remaining refundable amount.');
  }

  const refund = await getRefund(db, viewerId, input.refundId);
  if (!refund) throw new Error('Updated refund could not be loaded.');
  return refund;
}

export async function deleteRefund(
  db: D1Database,
  viewerId: string,
  refundId: string,
): Promise<boolean> {
  const existing = await getRefund(db, viewerId, refundId);
  if (!existing) throw new DomainError('Refund was not found.', 'NOT_FOUND');
  await requireEditableExpense(db, viewerId, existing.expense_id);
  const result = await db
    .prepare('DELETE FROM refunds WHERE id = ? AND viewer_id = ?')
    .bind(refundId, viewerId)
    .run();
  return result.meta.changes === 1;
}
