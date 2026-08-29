import { useQuery } from '@tanstack/react-query';
import {
  budgetQuery,
  budgetsQuery,
  dashboardQuery,
  expensesQuery,
  graphqlRequest,
  profileQuery,
} from './graphql';
import type { Budget, DashboardData, Expense, Profile } from '../types/app';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  budgets: ['budgets'] as const,
  budget: (id: string) => ['budget', id] as const,
  expenses: ['expenses'] as const,
  profile: ['profile'] as const,
};

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => graphqlRequest<DashboardData>(dashboardQuery),
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: queryKeys.budgets,
    queryFn: () => graphqlRequest<{ budgets: Budget[] }>(budgetsQuery),
  });
}

export function useBudget(id: string) {
  return useQuery({
    queryKey: queryKeys.budget(id),
    queryFn: () => graphqlRequest<{ budget: Budget | null }>(budgetQuery, { id }),
    enabled: Boolean(id),
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses,
    queryFn: () => graphqlRequest<{ expenses: Expense[] }>(expensesQuery),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => graphqlRequest<{ profile: Profile }>(profileQuery),
  });
}
