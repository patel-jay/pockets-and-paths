import type { CategoryIconKey } from '../../shared/category-icons';
import type { BudgetPhase } from '../../shared/budget-phase';

export type Money = {
  minor: string;
  currency: string;
};

export type Profile = {
  id: string;
  displayName: string;
  defaultCurrency: string;
  locale: string;
};

export type Category = {
  id: string;
  name: string;
  hasLimit: boolean;
  limit: Money | null;
  spent: Money;
  remaining: Money | null;
  overspent: Money | null;
  progress: number | null;
  color: string;
  icon: CategoryIconKey;
};

export type Budget = {
  id: string;
  name: string;
  type: 'MONTHLY' | 'TEMPORARY';
  currency: string;
  amount: Money;
  spent: Money;
  remaining: Money;
  overspent: Money;
  isOverBudget: boolean;
  progress: number;
  allocated: Money;
  unallocated: Money;
  overallocated: Money;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  phase: BudgetPhase;
  periodStart: string | null;
  categories: Category[];
  expenses?: Expense[];
};

export type Expense = {
  id: string;
  title: string;
  amount: Money;
  expenseDate: string;
  notes: string | null;
  budgetId: string;
  budgetName: string;
  budgetStatus: 'ACTIVE' | 'ARCHIVED';
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: CategoryIconKey;
  periodStart: string | null;
};

export type ExpensePage = {
  items: Expense[];
  nextCursor: string | null;
};

export type CurrencyBalance = {
  currency: string;
  remaining: Money;
  overspent: Money;
  budgetCount: number;
};

export type DashboardData = {
  dashboard: {
    profile: Profile;
    balances: CurrencyBalance[];
    openBudgets: Budget[];
    recentExpenses: Expense[];
  };
};

export type ExpenseImpact = {
  budgetProjectedSpent: Money;
  budgetOverspent: Money;
  budgetWillOverspend: boolean;
  categoryName: string;
  categoryHasLimit: boolean;
  categoryProjectedSpent: Money;
  categoryOverspent: Money | null;
  categoryWillOverspend: boolean;
};

export type YearCategoryTotal = {
  name: string;
  spent: Money;
};

export type YearMonthAnalysis = {
  month: number;
  periodStart: string;
  planned: Money;
  monthlySpent: Money;
  tripSpent: Money;
  totalSpent: Money;
  categories: YearCategoryTotal[];
};

export type YearCurrencyAnalysis = {
  currency: string;
  planned: Money;
  monthlySpent: Money;
  tripSpent: Money;
  totalSpent: Money;
  remaining: Money;
  overspent: Money;
  months: YearMonthAnalysis[];
  categories: YearCategoryTotal[];
};

export type YearTripAnalysis = {
  id: string;
  name: string;
  currency: string;
  startDate: string;
  endDate: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  planned: Money;
  spent: Money;
  remaining: Money;
  overspent: Money;
  isOverBudget: boolean;
  cashFlowInYear: Money;
};

export type YearAnalysis = {
  year: number;
  isCurrentYear: boolean;
  monthsIncluded: number;
  availableYears: number[];
  currencies: YearCurrencyAnalysis[];
  trips: YearTripAnalysis[];
};
