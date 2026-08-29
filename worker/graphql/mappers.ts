import { optionalSpendingPosition, spendingPosition } from '../budget-math';
import type { BudgetRow, CategoryRow, ExpenseRow } from '../types';

export function mapMoney(minor: number, currency: string) {
  return { minor: String(minor), currency };
}

export function mapExpense(expense: ExpenseRow) {
  return {
    id: expense.id,
    title: expense.title,
    originalAmount: mapMoney(expense.amount_minor, expense.currency),
    convertedAmount: mapMoney(
      expense.converted_amount_minor,
      expense.budget_currency ?? expense.currency,
    ),
    exchangeRate: (expense.exchange_rate_micros / 1_000_000)
      .toFixed(6)
      .replace(/0+$/, '')
      .replace(/\.$/, ''),
    expenseDate: expense.expense_date,
    notes: expense.notes,
    budgetId: expense.budget_id,
    budgetName: expense.budget_name ?? '',
    categoryId: expense.category_id,
    categoryName: expense.category_name ?? '',
  };
}

export function mapCategory(category: CategoryRow, budgetCurrency: string) {
  const spent = category.spent_minor ?? 0;
  const hasLimit = category.limit_minor_optional !== null;
  const position = optionalSpendingPosition(spent, category.limit_minor_optional);
  return {
    id: category.id,
    name: category.name,
    hasLimit,
    limit: hasLimit ? mapMoney(category.limit_minor_optional!, budgetCurrency) : null,
    spent: mapMoney(spent, budgetCurrency),
    remaining: position ? mapMoney(position.remaining, budgetCurrency) : null,
    overspent: position ? mapMoney(position.overspent, budgetCurrency) : null,
    progress: position?.progress ?? null,
    color: category.color,
  };
}

export function mapBudget(budget: BudgetRow) {
  const spent = budget.spent_minor ?? 0;
  const allocated = budget.allocated_minor ?? 0;
  const position = spendingPosition(spent, budget.amount_minor);
  const allocation = spendingPosition(allocated, budget.amount_minor);
  return {
    id: budget.id,
    name: budget.name,
    type: budget.type,
    reportingCurrency: budget.reporting_currency,
    amount: mapMoney(budget.amount_minor, budget.reporting_currency),
    spent: mapMoney(spent, budget.reporting_currency),
    remaining: mapMoney(position.remaining, budget.reporting_currency),
    overspent: mapMoney(position.overspent, budget.reporting_currency),
    isOverBudget: position.isOver,
    progress: position.progress,
    allocated: mapMoney(allocated, budget.reporting_currency),
    unallocated: mapMoney(allocation.remaining, budget.reporting_currency),
    overallocated: mapMoney(allocation.overspent, budget.reporting_currency),
    startDate: budget.start_date,
    endDate: budget.end_date,
    status: budget.status,
  };
}
