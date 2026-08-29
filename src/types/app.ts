export type Money = {
  minor: string;
  currency: string;
};

export type Profile = {
  id: string;
  displayName: string;
  baseCurrency: string;
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
};

export type Budget = {
  id: string;
  name: string;
  type: 'MONTHLY' | 'TEMPORARY';
  reportingCurrency: string;
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
  categories: Category[];
  expenses?: Expense[];
};

export type Expense = {
  id: string;
  title: string;
  originalAmount: Money;
  convertedAmount: Money;
  exchangeRate: string;
  expenseDate: string;
  notes: string | null;
  budgetId: string;
  budgetName: string;
  categoryId: string;
  categoryName: string;
};

export type DashboardData = {
  dashboard: {
    profile: Profile;
    available: Money;
    overspent: Money;
    activeBudgets: Budget[];
    recentExpenses: Expense[];
  };
};

export type ExpenseImpact = {
  convertedAmount: Money;
  budgetProjectedSpent: Money;
  budgetOverspent: Money;
  budgetWillOverspend: boolean;
  categoryName: string;
  categoryHasLimit: boolean;
  categoryProjectedSpent: Money;
  categoryOverspent: Money | null;
  categoryWillOverspend: boolean;
};
