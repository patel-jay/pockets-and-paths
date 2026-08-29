export type CreateBudgetInput = {
  name: string;
  type: 'MONTHLY' | 'TEMPORARY';
  reportingCurrency: string;
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
  currency: string;
  exchangeRate: string | null;
  expenseDate: string;
  notes: string | null;
};

export type ExpenseImpactInput = Pick<
  AddExpenseInput,
  'budgetId' | 'categoryId' | 'amountMinor' | 'currency' | 'exchangeRate'
>;

export type UpdateProfileInput = {
  displayName: string;
  baseCurrency: string;
  locale: string;
};
