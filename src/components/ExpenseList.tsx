import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteExpenseMutation, graphqlRequest } from '../lib/graphql';
import { formatDate, formatMoney } from '../lib/money';
import type { Expense } from '../types/app';
import { CategoryIcon } from './CategoryIcon';

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
  const deleteMutation = useMutation({
    mutationFn: (id: string) => graphqlRequest(deleteExpenseMutation, { id }),
    onSuccess: async () => queryClient.invalidateQueries(),
  });

  const remove = (expense: Expense) => {
    if (!window.confirm(`Delete “${expense.title}”? This cannot be undone.`)) return;
    deleteMutation.mutate(expense.id);
  };

  return (
    <>
      <div className="expense-list">
        {expenses.map((expense) => {
          return (
            <article
              className={`expense-row${editable && expense.budgetStatus === 'ACTIVE' ? ' expense-row--editable' : ''}`}
              key={expense.id}
            >
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
                <strong>{expense.title}</strong>
                <small>
                  {expense.categoryName} · {expense.budgetName} ·{' '}
                  {formatDate(expense.expenseDate, locale)}
                </small>
              </span>
              <span className="expense-row__amount">
                <strong>
                  {formatMoney(expense.amount.minor, expense.amount.currency, locale)}
                </strong>
              </span>
              {editable && expense.budgetStatus === 'ACTIVE' && (
                <span className="expense-row__actions">
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
                    disabled={deleteMutation.isPending}
                    onClick={() => remove(expense)}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              )}
            </article>
          );
        })}
      </div>
      {deleteMutation.error && (
        <p className="panel-error" role="alert">
          {(deleteMutation.error as Error).message}
        </p>
      )}
    </>
  );
}
