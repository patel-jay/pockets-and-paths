import { createSchema } from 'graphql-yoga';
import { getBudgetPhase, utcTodayIso } from '../../shared/budget-phase';
import {
  createBudget,
  createCategory,
  createExpense,
  deleteExpense,
  getBudget,
  getBudgets,
  getCategories,
  getExpenses,
  getExpensePage,
  getProfile,
  getYearAnalysis,
  summarizeBalancesByCurrency,
  previewExpenseImpact,
  splitCategoryLimits,
  setBudgetStatus,
  updateCategory,
  updateBudget,
  updateProfile,
  updateExpense,
} from '../data';
import type {
  AddExpenseInput,
  CreateBudgetInput,
  CreateCategoryInput,
  ExpenseImpactInput,
  ExpenseFilterInput,
  RequestContext,
  BudgetStatus,
  UpdateCategoryInput,
  UpdateBudgetInput,
  UpdateProfileInput,
  UpdateExpenseInput,
} from '../types';
import { mapBudget, mapCategory, mapExpense, mapMoney, mapYearAnalysis } from './mappers';
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
      budgets: async (_root, args: { status?: BudgetStatus }, context) => {
        const budgets = await getBudgets(context.env.DB, context.viewerId, args.status ?? 'ACTIVE');
        return budgets.map((budget) => mapBudget(budget));
      },
      budget: async (_root, args: { id: string; periodStart?: string }, context) => {
        const budget = await getBudget(context.env.DB, context.viewerId, args.id, args.periodStart);
        return budget ? mapBudget(budget) : null;
      },
      expenses: async (_root, args: { budgetId?: string; limit?: number }, context) => {
        const expenses = await getExpenses(context.env.DB, context.viewerId, args);
        return expenses.map(mapExpense);
      },
      expensePage: async (
        _root,
        args: { filter?: ExpenseFilterInput; first?: number; after?: string },
        context,
      ) => {
        const page = await getExpensePage(
          context.env.DB,
          context.viewerId,
          args.filter,
          args.first,
          args.after,
        );
        return { items: page.items.map(mapExpense), nextCursor: page.nextCursor };
      },
      yearAnalysis: async (_root, args: { year: number }, context) =>
        mapYearAnalysis(await getYearAnalysis(context.env.DB, context.viewerId, args.year)),
      dashboard: async (_root, _args, context) => {
        const [profile, budgets, recentExpenses] = await Promise.all([
          getProfile(context.env.DB, context.viewerId),
          getBudgets(context.env.DB, context.viewerId),
          getExpenses(context.env.DB, context.viewerId, { budgetStatus: 'ACTIVE', limit: 5 }),
        ]);
        const today = utcTodayIso();
        const openBudgets = budgets.filter(
          (budget) =>
            getBudgetPhase(
              {
                type: budget.type,
                startDate: budget.start_date,
                endDate: budget.end_date,
              },
              today,
            ) !== 'ENDED',
        );

        return {
          profile: {
            id: profile.viewer_id,
            displayName: profile.display_name,
            defaultCurrency: profile.base_currency,
            locale: profile.locale,
          },
          balances: summarizeBalancesByCurrency(openBudgets).map((balance) => ({
            currency: balance.currency,
            remaining: mapMoney(balance.remainingMinor, balance.currency),
            overspent: mapMoney(balance.overspentMinor, balance.currency),
            budgetCount: balance.budgetCount,
          })),
          openBudgets: openBudgets.map((budget) => mapBudget(budget, today)),
          recentExpenses: recentExpenses.map(mapExpense),
        };
      },
    },
    Budget: {
      categories: async (
        budget: {
          id: string;
          currency: string;
          _periodId: string | null;
          _periodScoped: boolean;
        },
        _args,
        context,
      ) => {
        const categories = await getCategories(context.env.DB, context.viewerId, budget.id, {
          periodId: budget._periodId,
          periodScoped: budget._periodScoped,
        });
        return categories.map((category) => mapCategory(category, budget.currency));
      },
      expenses: async (
        budget: { id: string; _periodId: string | null; _periodScoped: boolean },
        args: { limit?: number },
        context,
      ) => {
        const expenses = await getExpenses(context.env.DB, context.viewerId, {
          budgetId: budget.id,
          limit: args.limit,
          periodId: budget._periodId,
          periodScoped: budget._periodScoped,
        });
        return expenses.map(mapExpense);
      },
    },
    Mutation: {
      createBudget: async (_root, args: { input: CreateBudgetInput }, context) =>
        mapBudget(await createBudget(context.env.DB, context.viewerId, args.input)),
      updateBudget: async (_root, args: { input: UpdateBudgetInput }, context) =>
        mapBudget(await updateBudget(context.env.DB, context.viewerId, args.input)),
      archiveBudget: async (_root, args: { id: string }, context) =>
        mapBudget(await setBudgetStatus(context.env.DB, context.viewerId, args.id, 'ARCHIVED')),
      restoreBudget: async (_root, args: { id: string }, context) =>
        mapBudget(await setBudgetStatus(context.env.DB, context.viewerId, args.id, 'ACTIVE')),
      createCategory: async (_root, args: { input: CreateCategoryInput }, context) => {
        const category = await createCategory(context.env.DB, context.viewerId, args.input);
        const budget = await getBudget(context.env.DB, context.viewerId, args.input.budgetId);
        if (!budget) throw new Error('Budget was not found.');
        return mapCategory(category, budget.reporting_currency);
      },
      updateCategory: async (_root, args: { input: UpdateCategoryInput }, context) => {
        const category = await updateCategory(context.env.DB, context.viewerId, args.input);
        const budget = await getBudget(context.env.DB, context.viewerId, category.budget_id);
        if (!budget) throw new Error('Budget was not found.');
        return mapCategory(category, budget.reporting_currency);
      },
      splitCategoryLimits: async (_root, args: { budgetId: string }, context) =>
        mapBudget(await splitCategoryLimits(context.env.DB, context.viewerId, args.budgetId)),
      addExpense: async (_root, args: { input: AddExpenseInput }, context) =>
        mapExpense(await createExpense(context.env.DB, context.viewerId, args.input)),
      updateExpense: async (_root, args: { input: UpdateExpenseInput }, context) =>
        mapExpense(await updateExpense(context.env.DB, context.viewerId, args.input)),
      deleteExpense: async (_root, args: { id: string }, context) =>
        deleteExpense(context.env.DB, context.viewerId, args.id),
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
