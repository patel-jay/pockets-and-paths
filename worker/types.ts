import type { CategoryIconKey } from '../shared/category-icons';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface RequestContext {
  env: Env;
  viewerId: string;
}

export type BudgetType = 'MONTHLY' | 'TEMPORARY';
export type BudgetStatus = 'ACTIVE' | 'ARCHIVED';

export interface CreateBudgetInput {
  name: string;
  type: BudgetType;
  currency: string;
  amountMinor: string;
  startDate: string;
  endDate?: string | null;
}

export interface UpdateBudgetInput {
  budgetId: string;
  name: string;
  amountMinor: string;
  startDate: string;
  endDate?: string | null;
}

export interface CreateCategoryInput {
  budgetId: string;
  name: string;
  limitMinor?: string | null;
  color: string;
  icon: string;
}

export interface UpdateCategoryInput {
  categoryId: string;
  limitMinor?: string | null;
  color: string;
  icon: string;
}

export interface ExpenseImpactInput {
  budgetId: string;
  categoryId: string;
  amountMinor: string;
}

export interface AddExpenseInput extends ExpenseImpactInput {
  title: string;
  expenseDate: string;
  notes?: string | null;
}

export interface UpdateProfileInput {
  displayName: string;
  defaultCurrency: string;
  locale: string;
}

export interface ProfileRow {
  viewer_id: string;
  display_name: string;
  base_currency: string;
  locale: string;
  created_at: string;
}

export interface BudgetRow {
  id: string;
  viewer_id: string;
  name: string;
  type: BudgetType;
  reporting_currency: string;
  amount_minor: number;
  profile_rate_micros: number;
  start_date: string;
  end_date: string | null;
  status: BudgetStatus;
  created_at: string;
  spent_minor?: number;
  allocated_minor?: number;
}

export interface CategoryRow {
  id: string;
  budget_id: string;
  viewer_id: string;
  name: string;
  limit_minor: number;
  limit_minor_optional: number | null;
  color: string;
  icon_key: CategoryIconKey;
  created_at: string;
  spent_minor?: number;
}

export interface ExpenseRow {
  id: string;
  viewer_id: string;
  budget_id: string;
  category_id: string;
  title: string;
  amount_minor: number;
  currency: string;
  exchange_rate_micros: number;
  converted_amount_minor: number;
  expense_date: string;
  notes: string | null;
  created_at: string;
  budget_name?: string;
  budget_currency?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: CategoryIconKey;
}

export interface ExpenseImpact {
  budgetCurrency: string;
  budgetProjectedSpentMinor: number;
  budgetOverspentMinor: number;
  categoryName: string;
  categoryHasLimit: boolean;
  categoryProjectedSpentMinor: number;
  categoryOverspentMinor: number;
}

export interface CurrencyBalance {
  currency: string;
  remainingMinor: number;
  overspentMinor: number;
  budgetCount: number;
}
