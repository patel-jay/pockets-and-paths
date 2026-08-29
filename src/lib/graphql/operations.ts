import type { Budget, DashboardData, Expense, ExpenseImpact, Profile } from '../../types/app';
import type {
  AddExpenseInput,
  CreateBudgetInput,
  CreateCategoryInput,
  ExpenseImpactInput,
  UpdateProfileInput,
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
        baseCurrency
        locale
      }
      available {
        ...MoneyFields
      }
      overspent {
        ...MoneyFields
      }
      activeBudgets {
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

export const budgetQuery = defineOperation<{ budget: Budget | null }, { id: string }>(
  /* GraphQL */ `
    ${moneyFragment}
    ${categoryFragment}
    ${budgetFragment}
    ${expenseFragment}
    query Budget($id: ID!) {
      budget(id: $id) {
        ...BudgetFields
        expenses(limit: 100) {
          ...ExpenseFields
        }
      }
    }
  `,
);

export const expensesQuery = defineOperation<{ expenses: Expense[] }>(/* GraphQL */ `
  ${moneyFragment}
  ${expenseFragment}
  query Expenses {
    expenses(limit: 200) {
      ...ExpenseFields
    }
  }
`);

export const profileQuery = defineOperation<{ profile: Profile }>(/* GraphQL */ `
  query Profile {
    profile {
      id
      displayName
      baseCurrency
      locale
    }
  }
`);

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

export const previewExpenseMutation = defineOperation<
  { previewExpense: ExpenseImpact },
  { input: ExpenseImpactInput }
>(/* GraphQL */ `
  ${moneyFragment}
  mutation PreviewExpense($input: ExpenseImpactInput!) {
    previewExpense(input: $input) {
      convertedAmount {
        ...MoneyFields
      }
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

export const updateCategoryLimitMutation = defineOperation<
  { updateCategoryLimit: { id: string } },
  { categoryId: string; limitMinor: string | null }
>(/* GraphQL */ `
  mutation UpdateCategoryLimit($categoryId: ID!, $limitMinor: String) {
    updateCategoryLimit(categoryId: $categoryId, limitMinor: $limitMinor) {
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
      baseCurrency
      locale
    }
  }
`);
