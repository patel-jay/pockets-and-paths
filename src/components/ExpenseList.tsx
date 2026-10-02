import { Fragment, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { deleteExpenseMutation, deleteRefundMutation, graphqlRequest } from '../lib/graphql';
import { formatDate, formatMoney } from '../lib/money';
import type { Expense, Refund } from '../types/app';
import { CategoryIcon } from './CategoryIcon';
import { RefundModal } from './RefundModal';

export function ExpenseList({
  expenses,
  locale = 'en-IN',
  editable = false,
  onEdit,
}: {
  expenses: Expense[];
  locale?: string;
  editable?: boolean;
  onEdit?: (expense: Expense) => void;
}) {
  const queryClient = useQueryClient();
  const [refundingExpense, setRefundingExpense] = useState<Expense | null>(null);
  const [editingRefund, setEditingRefund] = useState<{
    expense: Expense;
    refund: Refund;
  } | null>(null);
  const deleteExpenseMutationState = useMutation({
    mutationFn: (id: string) => graphqlRequest(deleteExpenseMutation, { id }),
    onSuccess: async () => queryClient.invalidateQueries(),
  });
  const deleteRefundMutationState = useMutation({
    mutationFn: (id: string) => graphqlRequest(deleteRefundMutation, { id }),
    onSuccess: async () => queryClient.invalidateQueries(),
  });

  const removeExpense = (expense: Expense) => {
    if (expense.refunds.length > 0) {
      window.alert('Delete the recorded refunds before deleting this expense.');
      return;
    }
    if (!window.confirm(`Delete “${expense.title}”? This cannot be undone.`)) return;
    deleteExpenseMutationState.mutate(expense.id);
  };

  const removeRefund = (expense: Expense, refund: Refund) => {
    if (
      !window.confirm(
        `Delete the ${formatMoney(refund.amount.minor, refund.amount.currency, locale)} refund for “${expense.title}”?`,
      )
    ) {
      return;
    }
    deleteRefundMutationState.mutate(refund.id);
  };

  return (
    <>
      <div className="expense-list">
        {expenses.map((expense) => {
          const canEdit = editable && expense.budgetStatus === 'ACTIVE';
          const isFullyRefunded = expense.refundStatus === 'FULL';

          return (
            <Fragment key={expense.id}>
              <article className={`expense-row${canEdit ? ' expense-row--editable' : ''}`}>
                <span
                  className="expense-row__icon"
                  style={{
                    color: expense.categoryColor,
                    backgroundColor: `${expense.categoryColor}1f`,
                  }}
                >
                  <CategoryIcon icon={expense.categoryIcon} size={19} />
                </span>
                <span className="expense-row__copy">
                  <span className="expense-row__title">
                    <strong>{expense.title}</strong>
                    {expense.refundStatus && (
                      <span
                        className={`refund-status refund-status--${expense.refundStatus.toLowerCase()}`}
                      >
                        {isFullyRefunded ? 'Fully refunded' : 'Partially refunded'}
                      </span>
                    )}
                  </span>
                  <small>
                    {expense.categoryName} · {expense.budgetName} ·{' '}
                    {formatDate(expense.expenseDate, locale)}
                  </small>
                </span>
                <span className="expense-row__amount">
                  <strong>
                    {formatMoney(expense.netAmount.minor, expense.netAmount.currency, locale)}
                  </strong>
                  {expense.refundStatus && (
                    <small>
                      {formatMoney(
                        expense.refundedAmount.minor,
                        expense.refundedAmount.currency,
                        locale,
                      )}{' '}
                      refunded
                    </small>
                  )}
                </span>
                {canEdit && (
                  <span className="expense-row__actions">
                    <button
                      type="button"
                      aria-label={
                        isFullyRefunded
                          ? `${expense.title} is fully refunded`
                          : `Record refund for ${expense.title}`
                      }
                      title={
                        isFullyRefunded ? 'This expense has been fully refunded' : 'Record refund'
                      }
                      disabled={isFullyRefunded}
                      onClick={() => setRefundingExpense(expense)}
                    >
                      <RotateCcw size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${expense.title}`}
                      onClick={() => onEdit?.(expense)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${expense.title}`}
                      disabled={deleteExpenseMutationState.isPending}
                      onClick={() => removeExpense(expense)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </span>
                )}
              </article>

              {expense.refunds.map((refund) => (
                <article
                  className={`expense-row expense-row--refund${canEdit ? ' expense-row--editable' : ''}`}
                  key={refund.id}
                >
                  <span className="expense-row__icon expense-row__icon--refund">
                    <RotateCcw size={18} aria-hidden="true" />
                  </span>
                  <span className="expense-row__copy">
                    <strong>Refund · {expense.title}</strong>
                    <small>
                      Received {formatDate(refund.refundDate, locale)}
                      {refund.notes ? ` · ${refund.notes}` : ''}
                    </small>
                  </span>
                  <span className="expense-row__amount expense-row__amount--refund">
                    <strong>
                      +{formatMoney(refund.amount.minor, refund.amount.currency, locale)}
                    </strong>
                  </span>
                  {canEdit && (
                    <span className="expense-row__actions">
                      <button
                        type="button"
                        aria-label={`Edit refund for ${expense.title}`}
                        onClick={() => setEditingRefund({ expense, refund })}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete refund for ${expense.title}`}
                        disabled={deleteRefundMutationState.isPending}
                        onClick={() => removeRefund(expense, refund)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </span>
                  )}
                </article>
              ))}
            </Fragment>
          );
        })}
      </div>
      {(deleteExpenseMutationState.error || deleteRefundMutationState.error) && (
        <p className="panel-error" role="alert">
          {((deleteExpenseMutationState.error ?? deleteRefundMutationState.error) as Error).message}
        </p>
      )}
      {refundingExpense && (
        <RefundModal
          open
          expense={refundingExpense}
          locale={locale}
          onClose={() => setRefundingExpense(null)}
        />
      )}
      {editingRefund && (
        <RefundModal
          open
          expense={editingRefund.expense}
          refund={editingRefund.refund}
          locale={locale}
          onClose={() => setEditingRefund(null)}
        />
      )}
    </>
  );
}
