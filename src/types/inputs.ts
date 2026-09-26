import type { CategoryIconKey } from '../../shared/category-icons';

export type CreateBudgetInput = {
  name: string;
  type: 'MONTHLY' | 'TEMPORARY';
  currency: string;
  amountMinor: string;
  startDate: string;
  endDate: string | null;
};

export type UpdateBudgetInput = Omit<CreateBudgetInput, 'type' | 'currency'> & {
  budgetId: string;
};

export type CreateCategoryInput = {
  budgetId: string;
  name: string;
  limitMinor: string | null;
  color: string;
  icon: CategoryIconKey;
};

export type UpdateCategoryInput = {
  categoryId: string;
  limitMinor: string | null;
  color: string;
  icon: CategoryIconKey;
};

export type AddExpenseInput = {
  budgetId: string;
  categoryId: string;
  title: string;
  amountMinor: string;
  expenseDate: string;
  notes: string | null;
};

export type ExpenseImpactInput = Pick<
  AddExpenseInput,
  'budgetId' | 'categoryId' | 'amountMinor' | 'expenseDate'
> & { excludeExpenseId?: string | null };

export type UpdateExpenseInput = AddExpenseInput & {
  expenseId: string;
};

export type ExpenseFilters = {
  budgetId?: string | null;
  categoryId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
};

export type UpdateProfileInput = {
  displayName: string;
  defaultCurrency: string;
  locale: string;
};
