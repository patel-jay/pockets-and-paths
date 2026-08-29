export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface RequestContext {
  env: Env;
  viewerId: string;
}

export type BudgetType = 'MONTHLY' | 'TEMPORARY';

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
  status: string;
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
}

export interface ExpenseImpact {
  convertedAmountMinor: number;
  exchangeRateMicros: number;
  budgetCurrency: string;
  budgetProjectedSpentMinor: number;
  budgetOverspentMinor: number;
  categoryName: string;
  categoryHasLimit: boolean;
  categoryProjectedSpentMinor: number;
  categoryOverspentMinor: number;
}
