export const typeDefs = /* GraphQL */ `
  enum BudgetType {
    MONTHLY
    TEMPORARY
  }

  enum BudgetStatus {
    ACTIVE
    ARCHIVED
  }

  enum BudgetPhase {
    ACTIVE
    UPCOMING
    ENDED
  }

  enum RefundKind {
    FULL
    PARTIAL
  }

  enum RefundStatus {
    PARTIAL
    FULL
  }

  type Money {
    minor: String!
    currency: String!
  }

  type Profile {
    id: ID!
    displayName: String!
    defaultCurrency: String!
    locale: String!
  }

  type Category {
    id: ID!
    name: String!
    hasLimit: Boolean!
    limit: Money
    spent: Money!
    refunded: Money!
    remaining: Money
    overspent: Money
    progress: Float
    color: String!
    icon: String!
  }

  type Budget {
    id: ID!
    name: String!
    type: BudgetType!
    currency: String!
    amount: Money!
    spent: Money!
    grossSpent: Money!
    refunded: Money!
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
    phase: BudgetPhase!
    periodStart: String
    categories: [Category!]!
    expenses(limit: Int = 50): [Expense!]!
  }

  type Expense {
    id: ID!
    title: String!
    amount: Money!
    refundedAmount: Money!
    netAmount: Money!
    refundStatus: RefundStatus
    refunds: [Refund!]!
    expenseDate: String!
    notes: String
    budgetId: ID!
    budgetName: String!
    budgetStatus: BudgetStatus!
    categoryId: ID!
    categoryName: String!
    categoryColor: String!
    categoryIcon: String!
    periodStart: String
  }

  type Refund {
    id: ID!
    amount: Money!
    refundDate: String!
    notes: String
  }

  type ExpensePage {
    items: [Expense!]!
    nextCursor: String
  }

  type Dashboard {
    profile: Profile!
    balances: [CurrencyBalance!]!
    openBudgets: [Budget!]!
    recentExpenses: [Expense!]!
  }

  type CurrencyBalance {
    currency: String!
    remaining: Money!
    overspent: Money!
    budgetCount: Int!
  }

  type YearCategoryTotal {
    name: String!
    spent: Money!
  }

  type YearMonthAnalysis {
    month: Int!
    periodStart: String!
    planned: Money!
    monthlySpent: Money!
    tripSpent: Money!
    totalSpent: Money!
    categories: [YearCategoryTotal!]!
  }

  type YearCurrencyAnalysis {
    currency: String!
    planned: Money!
    monthlySpent: Money!
    tripSpent: Money!
    totalSpent: Money!
    remaining: Money!
    overspent: Money!
    months: [YearMonthAnalysis!]!
    categories: [YearCategoryTotal!]!
  }

  type YearTripAnalysis {
    id: ID!
    name: String!
    currency: String!
    startDate: String!
    endDate: String
    status: BudgetStatus!
    planned: Money!
    grossSpent: Money!
    refunded: Money!
    spent: Money!
    remaining: Money!
    overspent: Money!
    isOverBudget: Boolean!
    cashFlowInYear: Money!
  }

  type YearAnalysis {
    year: Int!
    isCurrentYear: Boolean!
    monthsIncluded: Int!
    availableYears: [Int!]!
    currencies: [YearCurrencyAnalysis!]!
    trips: [YearTripAnalysis!]!
  }

  input CreateBudgetInput {
    name: String!
    type: BudgetType!
    currency: String!
    amountMinor: String!
    startDate: String!
    endDate: String
  }

  input UpdateBudgetInput {
    budgetId: ID!
    name: String!
    amountMinor: String!
    startDate: String!
    endDate: String
  }

  input CreateCategoryInput {
    budgetId: ID!
    name: String!
    limitMinor: String
    color: String!
    icon: String!
  }

  input UpdateCategoryInput {
    categoryId: ID!
    limitMinor: String
    color: String!
    icon: String!
  }

  input AddExpenseInput {
    budgetId: ID!
    categoryId: ID!
    title: String!
    amountMinor: String!
    expenseDate: String!
    notes: String
  }

  input UpdateExpenseInput {
    expenseId: ID!
    budgetId: ID!
    categoryId: ID!
    title: String!
    amountMinor: String!
    expenseDate: String!
    notes: String
  }

  input CreateRefundInput {
    expenseId: ID!
    kind: RefundKind!
    amountMinor: String
    refundDate: String!
    notes: String
  }

  input UpdateRefundInput {
    refundId: ID!
    amountMinor: String!
    refundDate: String!
    notes: String
  }

  input ExpenseImpactInput {
    budgetId: ID!
    categoryId: ID!
    amountMinor: String!
    expenseDate: String!
    excludeExpenseId: ID
  }

  input ExpenseFilterInput {
    budgetId: ID
    categoryId: ID
    dateFrom: String
    dateTo: String
    search: String
  }

  type ExpenseImpact {
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
    defaultCurrency: String!
    locale: String!
  }

  type Query {
    dashboard: Dashboard!
    profile: Profile!
    budgets(status: BudgetStatus = ACTIVE): [Budget!]!
    budget(id: ID!, periodStart: String): Budget
    expenses(budgetId: ID, limit: Int = 100): [Expense!]!
    expensePage(filter: ExpenseFilterInput, first: Int = 25, after: String): ExpensePage!
    yearAnalysis(year: Int!): YearAnalysis!
  }

  type Mutation {
    createBudget(input: CreateBudgetInput!): Budget!
    updateBudget(input: UpdateBudgetInput!): Budget!
    archiveBudget(id: ID!): Budget!
    restoreBudget(id: ID!): Budget!
    createCategory(input: CreateCategoryInput!): Category!
    updateCategory(input: UpdateCategoryInput!): Category!
    splitCategoryLimits(budgetId: ID!): Budget!
    addExpense(input: AddExpenseInput!): Expense!
    updateExpense(input: UpdateExpenseInput!): Expense!
    deleteExpense(id: ID!): Boolean!
    createRefund(input: CreateRefundInput!): Refund!
    updateRefund(input: UpdateRefundInput!): Refund!
    deleteRefund(id: ID!): Boolean!
    previewExpense(input: ExpenseImpactInput!): ExpenseImpact!
    updateProfile(input: UpdateProfileInput!): Profile!
  }
`;
