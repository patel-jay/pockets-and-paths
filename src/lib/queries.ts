import { useQuery } from '@tanstack/react-query';
import {
  budgetQuery,
  budgetsQuery,
  dashboardQuery,
  expensesQuery,
  graphqlRequest,
  profileQuery,
} from './graphql';

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
    queryFn: () => graphqlRequest(dashboardQuery),
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: queryKeys.budgets,
    queryFn: () => graphqlRequest(budgetsQuery),
  });
}

export function useBudget(id: string) {
  return useQuery({
    queryKey: queryKeys.budget(id),
    queryFn: () => graphqlRequest(budgetQuery, { id }),
    enabled: Boolean(id),
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: queryKeys.expenses,
    queryFn: () => graphqlRequest(expensesQuery),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: () => graphqlRequest(profileQuery),
  });
}
