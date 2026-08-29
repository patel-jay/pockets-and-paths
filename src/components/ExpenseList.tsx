import { ReceiptText } from 'lucide-react';
import { formatDate, formatMoney } from '../lib/money';
import type { Expense } from '../types/app';

export function ExpenseList({
  expenses,
  locale = 'en-IN',
}: {
  expenses: Expense[];
  locale?: string;
}) {
  return (
    <div className="expense-list">
      {expenses.map((expense) => {
        return (
          <article className="expense-row" key={expense.id}>
            <span className="expense-row__icon">
              <ReceiptText size={19} />
            </span>
            <span className="expense-row__copy">
              <strong>{expense.title}</strong>
              <small>
                {expense.categoryName} · {expense.budgetName} ·{' '}
                {formatDate(expense.expenseDate, locale)}
              </small>
            </span>
            <span className="expense-row__amount">
              <strong>{formatMoney(expense.amount.minor, expense.amount.currency, locale)}</strong>
            </span>
          </article>
        );
      })}
    </div>
  );
}
