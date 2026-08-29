export const moneyFragment = /* GraphQL */ `
  fragment MoneyFields on Money {
    minor
    currency
  }
`;

export const categoryFragment = /* GraphQL */ `
  fragment CategoryFields on Category {
    id
    name
    color
    hasLimit
    progress
    limit {
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
  }
`;

export const budgetFragment = /* GraphQL */ `
  fragment BudgetFields on Budget {
    id
    name
    type
    reportingCurrency
    progress
    startDate
    endDate
    status
    amount {
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
    allocated {
      ...MoneyFields
    }
    unallocated {
      ...MoneyFields
    }
    overallocated {
      ...MoneyFields
    }
    categories {
      ...CategoryFields
    }
  }
`;

export const expenseFragment = /* GraphQL */ `
  fragment ExpenseFields on Expense {
    id
    title
    expenseDate
    notes
    budgetId
    budgetName
    categoryId
    categoryName
    exchangeRate
    originalAmount {
      ...MoneyFields
    }
    convertedAmount {
      ...MoneyFields
    }
  }
`;
