export type CreateBudgetInput = {
  name: string;
  type: 'MONTHLY' | 'TEMPORARY';
  currency: string;
  amountMinor: string;
  startDate: string;
  endDate: string | null;
};

export type CreateCategoryInput = {
  budgetId: string;
  name: string;
  limitMinor: string | null;
  color: string;
};

export type AddExpenseInput = {
  budgetId: string;
  categoryId: string;
  title: string;
  amountMinor: string;
  expenseDate: string;
  notes: string | null;
};

export type ExpenseImpactInput = Pick<AddExpenseInput, 'budgetId' | 'categoryId' | 'amountMinor'>;

export type UpdateProfileInput = {
  displayName: string;
  defaultCurrency: string;
  locale: string;
};
