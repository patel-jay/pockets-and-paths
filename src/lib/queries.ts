import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  budgetQuery,
  budgetsQuery,
  archivedBudgetsQuery,
  dashboardQuery,
  expensesQuery,
  expensePageQuery,
  graphqlRequest,
  profileQuery,
  yearAnalysisQuery,
} from './graphql';
import type { ExpenseFilters } from '../types/inputs';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  budgets: ['budgets'] as const,
  budget: (id: string, periodStart?: string) =>
    periodStart ? (['budget', id, periodStart] as const) : (['budget', id] as const),
  expenses: ['expenses'] as const,
  profile: ['profile'] as const,
  yearAnalyses: ['year-analysis'] as const,
  yearAnalysis: (year: number) => ['year-analysis', year] as const,
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

export function useArchivedBudgets() {
  return useQuery({
    queryKey: [...queryKeys.budgets, 'archived'],
    queryFn: () => graphqlRequest(archivedBudgetsQuery),
  });
}

export function useBudget(id: string, periodStart?: string) {
  return useQuery({
    queryKey: queryKeys.budget(id, periodStart),
    queryFn: () => graphqlRequest(budgetQuery, { id, periodStart }),
    enabled: Boolean(id),
  });
}

export function useExpensePage(filter: ExpenseFilters) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.expenses, filter],
    queryFn: ({ pageParam }) =>
      graphqlRequest(expensePageQuery, {
        filter,
        first: 25,
        after: pageParam || undefined,
      }),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.expensePage.nextCursor ?? undefined,
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

export function useYearAnalysis(year: number) {
  return useQuery({
    queryKey: queryKeys.yearAnalysis(year),
    queryFn: () => graphqlRequest(yearAnalysisQuery, { year }),
  });
}
