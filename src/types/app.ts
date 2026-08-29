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
  categoryId: string;
  categoryName: string;
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
    activeBudgets: Budget[];
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
