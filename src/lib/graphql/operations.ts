import type {
  Budget,
  DashboardData,
  Expense,
  ExpenseImpact,
  ExpensePage,
  Profile,
  YearAnalysis,
} from '../../types/app';
import type {
  AddExpenseInput,
  CreateBudgetInput,
  CreateCategoryInput,
  ExpenseImpactInput,
  ExpenseFilters,
  UpdateCategoryInput,
  UpdateBudgetInput,
  UpdateProfileInput,
  UpdateExpenseInput,
} from '../../types/inputs';
import { defineOperation } from './client';
import { budgetFragment, categoryFragment, expenseFragment, moneyFragment } from './fragments';

export const dashboardQuery = defineOperation<DashboardData>(/* GraphQL */ `
  ${moneyFragment}
  ${categoryFragment}
  ${budgetFragment}
  ${expenseFragment}
  query Dashboard {
    dashboard {
      profile {
        id
        displayName
        defaultCurrency
        locale
      }
      balances {
        currency
        budgetCount
        remaining {
          ...MoneyFields
        }
        overspent {
          ...MoneyFields
        }
      }
      openBudgets {
        ...BudgetFields
      }
      recentExpenses {
        ...ExpenseFields
      }
    }
  }
`);

export const budgetsQuery = defineOperation<{ budgets: Budget[] }>(/* GraphQL */ `
  ${moneyFragment}
  ${categoryFragment}
  ${budgetFragment}
  query Budgets {
    budgets {
      ...BudgetFields
    }
  }
`);

export const archivedBudgetsQuery = defineOperation<{ archivedBudgets: Budget[] }>(/* GraphQL */ `
  ${moneyFragment}
  ${categoryFragment}
  ${budgetFragment}
  query ArchivedBudgets {
    archivedBudgets: budgets(status: ARCHIVED) {
      ...BudgetFields
    }
  }
`);

export const budgetQuery = defineOperation<
  { budget: Budget | null },
  { id: string; periodStart?: string }
>(/* GraphQL */ `
  ${moneyFragment}
  ${categoryFragment}
  ${budgetFragment}
  ${expenseFragment}
  query Budget($id: ID!, $periodStart: String) {
    budget(id: $id, periodStart: $periodStart) {
      ...BudgetFields
      expenses(limit: 100) {
        ...ExpenseFields
      }
    }
  }
`);

export const expensesQuery = defineOperation<{ expenses: Expense[] }>(/* GraphQL */ `
  ${moneyFragment}
  ${expenseFragment}
  query Expenses {
    expenses(limit: 200) {
      ...ExpenseFields
    }
  }
`);

export const expensePageQuery = defineOperation<
  { expensePage: ExpensePage },
  { filter: ExpenseFilters; first: number; after?: string }
>(/* GraphQL */ `
  ${moneyFragment}
  ${expenseFragment}
  query ExpensePage($filter: ExpenseFilterInput!, $first: Int!, $after: String) {
    expensePage(filter: $filter, first: $first, after: $after) {
      items {
        ...ExpenseFields
      }
      nextCursor
    }
  }
`);

export const profileQuery = defineOperation<{ profile: Profile }>(/* GraphQL */ `
  query Profile {
    profile {
      id
      displayName
      defaultCurrency
      locale
    }
  }
`);

export const yearAnalysisQuery = defineOperation<{ yearAnalysis: YearAnalysis }, { year: number }>(
  /* GraphQL */ `
    ${moneyFragment}
    query YearAnalysis($year: Int!) {
      yearAnalysis(year: $year) {
        year
        isCurrentYear
        monthsIncluded
        availableYears
        currencies {
          currency
          planned {
            ...MoneyFields
          }
          monthlySpent {
            ...MoneyFields
          }
          tripSpent {
            ...MoneyFields
          }
          totalSpent {
            ...MoneyFields
          }
          remaining {
            ...MoneyFields
          }
          overspent {
            ...MoneyFields
          }
          categories {
            name
            spent {
              ...MoneyFields
            }
          }
          months {
            month
            periodStart
            planned {
              ...MoneyFields
            }
            monthlySpent {
              ...MoneyFields
            }
            tripSpent {
              ...MoneyFields
            }
            totalSpent {
              ...MoneyFields
            }
            categories {
              name
              spent {
                ...MoneyFields
              }
            }
          }
        }
        trips {
          id
          name
          currency
          startDate
          endDate
          status
          planned {
            ...MoneyFields
          }
          spent {
            ...MoneyFields
          }
          remaining {
            ...MoneyFields
          }
          overspent {
            ...MoneyFields
          }
          isOverBudget
          cashFlowInYear {
            ...MoneyFields
          }
        }
      }
    }
  `,
);

export const createBudgetMutation = defineOperation<
  { createBudget: Pick<Budget, 'id'> },
  { input: CreateBudgetInput }
>(/* GraphQL */ `
  mutation CreateBudget($input: CreateBudgetInput!) {
    createBudget(input: $input) {
      id
    }
  }
`);

export const updateBudgetMutation = defineOperation<
  { updateBudget: Pick<Budget, 'id'> },
  { input: UpdateBudgetInput }
>(/* GraphQL */ `
  mutation UpdateBudget($input: UpdateBudgetInput!) {
    updateBudget(input: $input) {
      id
    }
  }
`);

export const archiveBudgetMutation = defineOperation<
  { archiveBudget: Pick<Budget, 'id' | 'status'> },
  { id: string }
>(/* GraphQL */ `
  mutation ArchiveBudget($id: ID!) {
    archiveBudget(id: $id) {
      id
      status
    }
  }
`);

export const restoreBudgetMutation = defineOperation<
  { restoreBudget: Pick<Budget, 'id' | 'status'> },
  { id: string }
>(/* GraphQL */ `
  mutation RestoreBudget($id: ID!) {
    restoreBudget(id: $id) {
      id
      status
    }
  }
`);

export const addExpenseMutation = defineOperation<
  { addExpense: Pick<Expense, 'id'> },
  { input: AddExpenseInput }
>(/* GraphQL */ `
  mutation AddExpense($input: AddExpenseInput!) {
    addExpense(input: $input) {
      id
    }
  }
`);

export const updateExpenseMutation = defineOperation<
  { updateExpense: Pick<Expense, 'id'> },
  { input: UpdateExpenseInput }
>(/* GraphQL */ `
  mutation UpdateExpense($input: UpdateExpenseInput!) {
    updateExpense(input: $input) {
      id
    }
  }
`);

export const deleteExpenseMutation = defineOperation<{ deleteExpense: boolean }, { id: string }>(
  /* GraphQL */ `
    mutation DeleteExpense($id: ID!) {
      deleteExpense(id: $id)
    }
  `,
);

export const previewExpenseMutation = defineOperation<
  { previewExpense: ExpenseImpact },
  { input: ExpenseImpactInput }
>(/* GraphQL */ `
  ${moneyFragment}
  mutation PreviewExpense($input: ExpenseImpactInput!) {
    previewExpense(input: $input) {
      budgetProjectedSpent {
        ...MoneyFields
      }
      budgetOverspent {
        ...MoneyFields
      }
      budgetWillOverspend
      categoryName
      categoryHasLimit
      categoryProjectedSpent {
        ...MoneyFields
      }
      categoryOverspent {
        ...MoneyFields
      }
      categoryWillOverspend
    }
  }
`);

export const createCategoryMutation = defineOperation<
  { createCategory: { id: string } },
  { input: CreateCategoryInput }
>(/* GraphQL */ `
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
    }
  }
`);

export const updateCategoryMutation = defineOperation<
  { updateCategory: { id: string } },
  { input: UpdateCategoryInput }
>(/* GraphQL */ `
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      id
    }
  }
`);

export const splitCategoryLimitsMutation = defineOperation<
  { splitCategoryLimits: { id: string } },
  { budgetId: string }
>(/* GraphQL */ `
  mutation SplitCategoryLimits($budgetId: ID!) {
    splitCategoryLimits(budgetId: $budgetId) {
      id
    }
  }
`);

export const updateProfileMutation = defineOperation<
  { updateProfile: Profile },
  { input: UpdateProfileInput }
>(/* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      displayName
      defaultCurrency
      locale
    }
  }
`);
