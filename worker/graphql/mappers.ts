import { optionalSpendingPosition, spendingPosition } from '../budget-math';
import { getBudgetPhase, utcTodayIso } from '../../shared/budget-phase';
import type { BudgetRow, CategoryRow, ExpenseRow, YearAnalysis } from '../types';

export function mapMoney(minor: number, currency: string) {
  return { minor: String(minor), currency };
}

export function mapExpense(expense: ExpenseRow) {
  return {
    id: expense.id,
    title: expense.title,
    amount: mapMoney(expense.converted_amount_minor, expense.budget_currency ?? expense.currency),
    expenseDate: expense.expense_date,
    notes: expense.notes,
    budgetId: expense.budget_id,
    budgetName: expense.budget_name ?? '',
    budgetStatus: expense.budget_status ?? 'ACTIVE',
    categoryId: expense.category_id,
    categoryName: expense.category_name ?? '',
    categoryColor: expense.category_color ?? '#2e7064',
    categoryIcon: expense.category_icon ?? 'receipt',
    periodStart: expense.period_start ?? null,
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
    icon: category.icon_key,
  };
}

export function mapBudget(budget: BudgetRow, today = utcTodayIso()) {
  const amount = budget.period_amount_minor ?? budget.amount_minor;
  const spent = budget.spent_minor ?? 0;
  const allocated = budget.allocated_minor ?? 0;
  const position = spendingPosition(spent, amount);
  const allocation = spendingPosition(allocated, amount);
  return {
    id: budget.id,
    name: budget.name,
    type: budget.type,
    currency: budget.reporting_currency,
    amount: mapMoney(amount, budget.reporting_currency),
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
    phase: getBudgetPhase(
      {
        type: budget.type,
        startDate: budget.start_date,
        endDate: budget.end_date,
      },
      today,
    ),
    periodStart:
      budget.type === 'MONTHLY' ? (budget.period_start ?? today.slice(0, 7) + '-01') : null,
    _periodId: budget.period_id ?? null,
    _periodScoped: budget.type === 'MONTHLY',
  };
}

export function mapYearAnalysis(analysis: YearAnalysis) {
  const mapCategories = (
    categories: Array<{ name: string; spentMinor: number }>,
    currency: string,
  ) =>
    categories.map((category) => ({
      name: category.name,
      spent: mapMoney(category.spentMinor, currency),
    }));

  return {
    year: analysis.year,
    isCurrentYear: analysis.isCurrentYear,
    monthsIncluded: analysis.monthsIncluded,
    availableYears: analysis.availableYears,
    currencies: analysis.currencies.map((currency) => ({
      currency: currency.currency,
      planned: mapMoney(currency.plannedMinor, currency.currency),
      monthlySpent: mapMoney(currency.monthlySpentMinor, currency.currency),
      tripSpent: mapMoney(currency.tripSpentMinor, currency.currency),
      totalSpent: mapMoney(currency.totalSpentMinor, currency.currency),
      remaining: mapMoney(currency.remainingMinor, currency.currency),
      overspent: mapMoney(currency.overspentMinor, currency.currency),
      categories: mapCategories(currency.categories, currency.currency),
      months: currency.months.map((month) => ({
        month: month.month,
        periodStart: month.periodStart,
        planned: mapMoney(month.plannedMinor, currency.currency),
        monthlySpent: mapMoney(month.monthlySpentMinor, currency.currency),
        tripSpent: mapMoney(month.tripSpentMinor, currency.currency),
        totalSpent: mapMoney(month.totalSpentMinor, currency.currency),
        categories: mapCategories(month.categories, currency.currency),
      })),
    })),
    trips: analysis.trips.map((trip) => ({
      id: trip.id,
      name: trip.name,
      currency: trip.currency,
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status,
      planned: mapMoney(trip.plannedMinor, trip.currency),
      spent: mapMoney(trip.spentMinor, trip.currency),
      remaining: mapMoney(trip.remainingMinor, trip.currency),
      overspent: mapMoney(trip.overspentMinor, trip.currency),
      isOverBudget: trip.overspentMinor > 0,
      cashFlowInYear: mapMoney(trip.cashFlowInYearMinor, trip.currency),
    })),
  };
}
