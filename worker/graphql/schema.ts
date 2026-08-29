import { createSchema } from 'graphql-yoga';
import {
  createBudget,
  createCategory,
  createExpense,
  getBudget,
  getBudgets,
  getCategories,
  getExpenses,
  getProfile,
  summarizeBalancesByCurrency,
  previewExpenseImpact,
  splitCategoryLimits,
  updateCategoryLimit,
  updateProfile,
} from '../data';
import type {
  AddExpenseInput,
  CreateBudgetInput,
  CreateCategoryInput,
  ExpenseImpactInput,
  RequestContext,
  UpdateCategoryLimitInput,
  UpdateProfileInput,
} from '../types';
import { mapBudget, mapCategory, mapExpense, mapMoney } from './mappers';
import { typeDefs } from './type-defs';

export const schema = createSchema<RequestContext>({
  typeDefs,
  resolvers: {
    Query: {
      profile: async (_root, _args, context) => {
        const profile = await getProfile(context.env.DB, context.viewerId);
        return {
          id: profile.viewer_id,
          displayName: profile.display_name,
          defaultCurrency: profile.base_currency,
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
            defaultCurrency: profile.base_currency,
            locale: profile.locale,
          },
          balances: summarizeBalancesByCurrency(budgets).map((balance) => ({
            currency: balance.currency,
            remaining: mapMoney(balance.remainingMinor, balance.currency),
            overspent: mapMoney(balance.overspentMinor, balance.currency),
            budgetCount: balance.budgetCount,
          })),
          activeBudgets: budgets.map(mapBudget),
          recentExpenses: recentExpenses.map(mapExpense),
        };
      },
    },
    Budget: {
      categories: async (budget: { id: string; currency: string }, _args, context) => {
        const categories = await getCategories(context.env.DB, context.viewerId, budget.id);
        return categories.map((category) => mapCategory(category, budget.currency));
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
      createBudget: async (_root, args: { input: CreateBudgetInput }, context) =>
        mapBudget(await createBudget(context.env.DB, context.viewerId, args.input)),
      createCategory: async (_root, args: { input: CreateCategoryInput }, context) => {
        const category = await createCategory(context.env.DB, context.viewerId, args.input);
        const budget = await getBudget(context.env.DB, context.viewerId, args.input.budgetId);
        if (!budget) throw new Error('Budget was not found.');
        return mapCategory(category, budget.reporting_currency);
      },
      updateCategoryLimit: async (_root, args: UpdateCategoryLimitInput, context) => {
        const category = await updateCategoryLimit(context.env.DB, context.viewerId, args);
        const budget = await getBudget(context.env.DB, context.viewerId, category.budget_id);
        if (!budget) throw new Error('Budget was not found.');
        return mapCategory(category, budget.reporting_currency);
      },
      splitCategoryLimits: async (_root, args: { budgetId: string }, context) =>
        mapBudget(await splitCategoryLimits(context.env.DB, context.viewerId, args.budgetId)),
      addExpense: async (_root, args: { input: AddExpenseInput }, context) =>
        mapExpense(await createExpense(context.env.DB, context.viewerId, args.input)),
      previewExpense: async (_root, args: { input: ExpenseImpactInput }, context) => {
        const impact = await previewExpenseImpact(context.env.DB, context.viewerId, args.input);
        return {
          budgetProjectedSpent: mapMoney(impact.budgetProjectedSpentMinor, impact.budgetCurrency),
          budgetOverspent: mapMoney(impact.budgetOverspentMinor, impact.budgetCurrency),
          budgetWillOverspend: impact.budgetOverspentMinor > 0,
          categoryName: impact.categoryName,
          categoryHasLimit: impact.categoryHasLimit,
          categoryProjectedSpent: mapMoney(
            impact.categoryProjectedSpentMinor,
            impact.budgetCurrency,
          ),
          categoryOverspent: impact.categoryHasLimit
            ? mapMoney(impact.categoryOverspentMinor, impact.budgetCurrency)
            : null,
          categoryWillOverspend: impact.categoryHasLimit && impact.categoryOverspentMinor > 0,
        };
      },
      updateProfile: async (_root, args: { input: UpdateProfileInput }, context) => {
        const profile = await updateProfile(context.env.DB, context.viewerId, args.input);
        return {
          id: profile.viewer_id,
          displayName: profile.display_name,
          defaultCurrency: profile.base_currency,
          locale: profile.locale,
        };
      },
    },
  },
});
