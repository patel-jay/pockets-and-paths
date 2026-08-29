export const typeDefs = /* GraphQL */ `
  enum BudgetType {
    MONTHLY
    TEMPORARY
  }

  enum BudgetStatus {
    ACTIVE
    ARCHIVED
  }

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
    type: BudgetType!
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
    status: BudgetStatus!
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
    type: BudgetType!
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
