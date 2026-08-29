import { createSchema } from 'graphql-yoga';
import {
  availableInProfileCurrency,
  createBudget,
  createCategory,
  createExpense,
  getBudget,
  getBudgets,
  getCategories,
  getExpenses,
  getProfile,
  overspentInProfileCurrency,
  previewExpenseImpact,
  splitCategoryLimits,
  updateCategoryLimit,
  updateProfile,
} from './database';
import type { BudgetRow, CategoryRow, ExpenseRow, RequestContext } from './types';
import { optionalSpendingPosition, spendingPosition } from './budget-math';

const typeDefs = /* GraphQL */ `
  type Money {
    minor: String!
    currency: String!
  }

  type Profile {
    id: ID!
    displayName: String!
    baseCurrency: String!
    locale: String!
  }

  type Category {
    id: ID!
    name: String!
    hasLimit: Boolean!
    limit: Money
    spent: Money!
    remaining: Money
    overspent: Money
    progress: Float
    color: String!
  }

  type Budget {
    id: ID!
    name: String!
    type: String!
    reportingCurrency: String!
    amount: Money!
    spent: Money!
    remaining: Money!
    overspent: Money!
    isOverBudget: Boolean!
    progress: Float!
    allocated: Money!
    unallocated: Money!
    overallocated: Money!
    startDate: String!
    endDate: String
    status: String!
    categories: [Category!]!
    expenses(limit: Int = 50): [Expense!]!
  }

  type Expense {
    id: ID!
    title: String!
    originalAmount: Money!
    convertedAmount: Money!
    exchangeRate: String!
    expenseDate: String!
    notes: String
    budgetId: ID!
    budgetName: String!
    categoryId: ID!
    categoryName: String!
  }

  type Dashboard {
    profile: Profile!
    available: Money!
    overspent: Money!
    activeBudgets: [Budget!]!
    recentExpenses: [Expense!]!
  }

  input CreateBudgetInput {
    name: String!
    type: String!
    reportingCurrency: String!
    amountMinor: String!
    startDate: String!
    endDate: String
  }

  input CreateCategoryInput {
    budgetId: ID!
    name: String!
    limitMinor: String
    color: String!
  }

  input AddExpenseInput {
    budgetId: ID!
    categoryId: ID!
    title: String!
    amountMinor: String!
    currency: String!
    exchangeRate: String
    expenseDate: String!
    notes: String
  }

  input ExpenseImpactInput {
    budgetId: ID!
    categoryId: ID!
    amountMinor: String!
    currency: String!
    exchangeRate: String
  }

  type ExpenseImpact {
    convertedAmount: Money!
    budgetProjectedSpent: Money!
    budgetOverspent: Money!
    budgetWillOverspend: Boolean!
    categoryName: String!
    categoryHasLimit: Boolean!
    categoryProjectedSpent: Money!
    categoryOverspent: Money
    categoryWillOverspend: Boolean!
  }

  input UpdateProfileInput {
    displayName: String!
    baseCurrency: String!
    locale: String!
  }

  type Query {
    dashboard: Dashboard!
    profile: Profile!
    budgets: [Budget!]!
    budget(id: ID!): Budget
    expenses(budgetId: ID, limit: Int = 100): [Expense!]!
  }

  type Mutation {
    createBudget(input: CreateBudgetInput!): Budget!
    createCategory(input: CreateCategoryInput!): Category!
    updateCategoryLimit(categoryId: ID!, limitMinor: String): Category!
    splitCategoryLimits(budgetId: ID!): Budget!
    addExpense(input: AddExpenseInput!): Expense!
    previewExpense(input: ExpenseImpactInput!): ExpenseImpact!
    updateProfile(input: UpdateProfileInput!): Profile!
  }
`;

function money(minor: number, currency: string) {
  return { minor: String(minor), currency };
}

function mapExpense(expense: ExpenseRow) {
  return {
    id: expense.id,
    title: expense.title,
    originalAmount: money(expense.amount_minor, expense.currency),
    convertedAmount: money(
      expense.converted_amount_minor,
      expense.budget_currency ?? expense.currency,
    ),
    exchangeRate: (expense.exchange_rate_micros / 1_000_000)
      .toFixed(6)
      .replace(/0+$/, '')
      .replace(/\.$/, ''),
    expenseDate: expense.expense_date,
    notes: expense.notes,
    budgetId: expense.budget_id,
    budgetName: expense.budget_name ?? '',
    categoryId: expense.category_id,
    categoryName: expense.category_name ?? '',
  };
}

function mapCategory(category: CategoryRow, budgetCurrency: string) {
  const spent = category.spent_minor ?? 0;
  const hasLimit = category.limit_minor_optional !== null;
  const position = optionalSpendingPosition(spent, category.limit_minor_optional);
  return {
    id: category.id,
    name: category.name,
    hasLimit,
    limit: hasLimit ? money(category.limit_minor_optional!, budgetCurrency) : null,
    spent: money(spent, budgetCurrency),
    remaining: position ? money(position.remaining, budgetCurrency) : null,
    overspent: position ? money(position.overspent, budgetCurrency) : null,
    progress: position?.progress ?? null,
    color: category.color,
  };
}

function mapBudget(budget: BudgetRow) {
  const spent = budget.spent_minor ?? 0;
  const allocated = budget.allocated_minor ?? 0;
  const position = spendingPosition(spent, budget.amount_minor);
  const allocation = spendingPosition(allocated, budget.amount_minor);
  return {
    id: budget.id,
    name: budget.name,
    type: budget.type,
    reportingCurrency: budget.reporting_currency,
    amount: money(budget.amount_minor, budget.reporting_currency),
    spent: money(spent, budget.reporting_currency),
    remaining: money(position.remaining, budget.reporting_currency),
    overspent: money(position.overspent, budget.reporting_currency),
    isOverBudget: position.isOver,
    progress: position.progress,
    allocated: money(allocated, budget.reporting_currency),
    unallocated: money(allocation.remaining, budget.reporting_currency),
    overallocated: money(allocation.overspent, budget.reporting_currency),
    startDate: budget.start_date,
    endDate: budget.end_date,
    status: budget.status,
  };
}

export const schema = createSchema<RequestContext>({
  typeDefs,
  resolvers: {
    Query: {
      profile: async (_root, _args, context) => {
        const profile = await getProfile(context.env.DB, context.viewerId);
        return {
          id: profile.viewer_id,
          displayName: profile.display_name,
          baseCurrency: profile.base_currency,
          locale: profile.locale,
        };
      },
      budgets: async (_root, _args, context) => {
        const budgets = await getBudgets(context.env.DB, context.viewerId);
        return budgets.map(mapBudget);
      },
      budget: async (_root, args: { id: string }, context) => {
        const budget = await getBudget(context.env.DB, context.viewerId, args.id);
        return budget ? mapBudget(budget) : null;
      },
      expenses: async (_root, args: { budgetId?: string; limit?: number }, context) => {
        const expenses = await getExpenses(context.env.DB, context.viewerId, args);
        return expenses.map(mapExpense);
      },
      dashboard: async (_root, _args, context) => {
        const [profile, budgets, recentExpenses] = await Promise.all([
          getProfile(context.env.DB, context.viewerId),
          getBudgets(context.env.DB, context.viewerId),
          getExpenses(context.env.DB, context.viewerId, { limit: 5 }),
        ]);

        return {
          profile: {
            id: profile.viewer_id,
            displayName: profile.display_name,
            baseCurrency: profile.base_currency,
            locale: profile.locale,
          },
          available: money(
            availableInProfileCurrency(budgets, profile.base_currency),
            profile.base_currency,
          ),
          overspent: money(
            overspentInProfileCurrency(budgets, profile.base_currency),
            profile.base_currency,
          ),
          activeBudgets: budgets.map(mapBudget),
          recentExpenses: recentExpenses.map(mapExpense),
        };
      },
    },
    Budget: {
      categories: async (budget: { id: string; reportingCurrency: string }, _args, context) => {
        const categories = await getCategories(context.env.DB, context.viewerId, budget.id);
        return categories.map((category) => mapCategory(category, budget.reportingCurrency));
      },
      expenses: async (budget: { id: string }, args: { limit?: number }, context) => {
        const expenses = await getExpenses(context.env.DB, context.viewerId, {
          budgetId: budget.id,
          limit: args.limit,
        });
        return expenses.map(mapExpense);
      },
    },
    Mutation: {
      createBudget: async (_root, args: { input: Parameters<typeof createBudget>[2] }, context) =>
        mapBudget(await createBudget(context.env.DB, context.viewerId, args.input)),
      createCategory: async (
        _root,
        args: { input: Parameters<typeof createCategory>[2] },
        context,
      ) => {
        const category = await createCategory(context.env.DB, context.viewerId, args.input);
        const budget = await getBudget(context.env.DB, context.viewerId, args.input.budgetId);
        if (!budget) throw new Error('Budget was not found.');
        return mapCategory(category, budget.reporting_currency);
      },
      updateCategoryLimit: async (
        _root,
        args: { categoryId: string; limitMinor?: string | null },
        context,
      ) => {
        const category = await updateCategoryLimit(context.env.DB, context.viewerId, args);
        const budget = await getBudget(context.env.DB, context.viewerId, category.budget_id);
        if (!budget) throw new Error('Budget was not found.');
        return mapCategory(category, budget.reporting_currency);
      },
      splitCategoryLimits: async (_root, args: { budgetId: string }, context) =>
        mapBudget(await splitCategoryLimits(context.env.DB, context.viewerId, args.budgetId)),
      addExpense: async (_root, args: { input: Parameters<typeof createExpense>[2] }, context) =>
        mapExpense(await createExpense(context.env.DB, context.viewerId, args.input)),
      previewExpense: async (
        _root,
        args: { input: Parameters<typeof previewExpenseImpact>[2] },
        context,
      ) => {
        const impact = await previewExpenseImpact(context.env.DB, context.viewerId, args.input);
        return {
          convertedAmount: money(impact.convertedAmountMinor, impact.budgetCurrency),
          budgetProjectedSpent: money(impact.budgetProjectedSpentMinor, impact.budgetCurrency),
          budgetOverspent: money(impact.budgetOverspentMinor, impact.budgetCurrency),
          budgetWillOverspend: impact.budgetOverspentMinor > 0,
          categoryName: impact.categoryName,
          categoryHasLimit: impact.categoryHasLimit,
          categoryProjectedSpent: money(impact.categoryProjectedSpentMinor, impact.budgetCurrency),
          categoryOverspent: impact.categoryHasLimit
            ? money(impact.categoryOverspentMinor, impact.budgetCurrency)
            : null,
          categoryWillOverspend: impact.categoryHasLimit && impact.categoryOverspentMinor > 0,
        };
      },
      updateProfile: async (
        _root,
        args: { input: Parameters<typeof updateProfile>[2] },
        context,
      ) => {
        const profile = await updateProfile(context.env.DB, context.viewerId, args.input);
        return {
          id: profile.viewer_id,
          displayName: profile.display_name,
          baseCurrency: profile.base_currency,
          locale: profile.locale,
        };
      },
    },
  },
});
