import { formatDate, formatMoney } from '../lib/money';
import type { Expense } from '../types/app';
import { CategoryIcon } from './CategoryIcon';

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
              <strong>{formatMoney(expense.amount.minor, expense.amount.currency, locale)}</strong>
            </span>
          </article>
        );
      })}
    </div>
  );
}
