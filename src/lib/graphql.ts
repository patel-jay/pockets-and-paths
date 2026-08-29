type GraphQLErrorResponse = {
  message: string;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: GraphQLErrorResponse[];
};

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch('/graphql', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`The server returned ${response.status}. Please try again.`);
  }

  const result = (await response.json()) as GraphQLResponse<T>;
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join(' '));
  }
  if (!result.data) throw new Error('The server returned no data.');

  return result.data;
}

export const dashboardQuery = /* GraphQL */ `
  query Dashboard {
    dashboard {
      profile {
        id
        displayName
        baseCurrency
        locale
      }
      available {
        minor
        currency
      }
      overspent {
        minor
        currency
      }
      activeBudgets {
        id
        name
        type
        reportingCurrency
        progress
        startDate
        endDate
        status
        amount {
          minor
          currency
        }
        spent {
          minor
          currency
        }
        remaining {
          minor
          currency
        }
        overspent {
          minor
          currency
        }
        isOverBudget
        allocated {
          minor
          currency
        }
        unallocated {
          minor
          currency
        }
        overallocated {
          minor
          currency
        }
        categories {
          id
          name
          color
          hasLimit
          progress
          limit {
            minor
            currency
          }
          spent {
            minor
            currency
          }
          remaining {
            minor
            currency
          }
          overspent {
            minor
            currency
          }
        }
      }
      recentExpenses {
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
          minor
          currency
        }
        convertedAmount {
          minor
          currency
        }
      }
    }
  }
`;

export const budgetsQuery = /* GraphQL */ `
  query Budgets {
    budgets {
      id
      name
      type
      reportingCurrency
      progress
      startDate
      endDate
      status
      amount {
        minor
        currency
      }
      spent {
        minor
        currency
      }
      remaining {
        minor
        currency
      }
      overspent {
        minor
        currency
      }
      isOverBudget
      allocated {
        minor
        currency
      }
      unallocated {
        minor
        currency
      }
      overallocated {
        minor
        currency
      }
      categories {
        id
        name
        color
        hasLimit
        progress
        limit {
          minor
          currency
        }
        spent {
          minor
          currency
        }
        remaining {
          minor
          currency
        }
        overspent {
          minor
          currency
        }
      }
    }
  }
`;

export const budgetQuery = /* GraphQL */ `
  query Budget($id: ID!) {
    budget(id: $id) {
      id
      name
      type
      reportingCurrency
      progress
      startDate
      endDate
      status
      amount {
        minor
        currency
      }
      spent {
        minor
        currency
      }
      remaining {
        minor
        currency
      }
      overspent {
        minor
        currency
      }
      isOverBudget
      allocated {
        minor
        currency
      }
      unallocated {
        minor
        currency
      }
      overallocated {
        minor
        currency
      }
      categories {
        id
        name
        color
        hasLimit
        progress
        limit {
          minor
          currency
        }
        spent {
          minor
          currency
        }
        remaining {
          minor
          currency
        }
        overspent {
          minor
          currency
        }
      }
      expenses(limit: 100) {
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
          minor
          currency
        }
        convertedAmount {
          minor
          currency
        }
      }
    }
  }
`;

export const expensesQuery = /* GraphQL */ `
  query Expenses {
    expenses(limit: 200) {
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
        minor
        currency
      }
      convertedAmount {
        minor
        currency
      }
    }
  }
`;

export const profileQuery = /* GraphQL */ `
  query Profile {
    profile {
      id
      displayName
      baseCurrency
      locale
    }
  }
`;

export const createBudgetMutation = /* GraphQL */ `
  mutation CreateBudget($input: CreateBudgetInput!) {
    createBudget(input: $input) {
      id
    }
  }
`;

export const addExpenseMutation = /* GraphQL */ `
  mutation AddExpense($input: AddExpenseInput!) {
    addExpense(input: $input) {
      id
    }
  }
`;

export const previewExpenseMutation = /* GraphQL */ `
  mutation PreviewExpense($input: ExpenseImpactInput!) {
    previewExpense(input: $input) {
      convertedAmount {
        minor
        currency
      }
      budgetProjectedSpent {
        minor
        currency
      }
      budgetOverspent {
        minor
        currency
      }
      budgetWillOverspend
      categoryName
      categoryHasLimit
      categoryProjectedSpent {
        minor
        currency
      }
      categoryOverspent {
        minor
        currency
      }
      categoryWillOverspend
    }
  }
`;

export const createCategoryMutation = /* GraphQL */ `
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
    }
  }
`;

export const updateCategoryLimitMutation = /* GraphQL */ `
  mutation UpdateCategoryLimit($categoryId: ID!, $limitMinor: String) {
    updateCategoryLimit(categoryId: $categoryId, limitMinor: $limitMinor) {
      id
    }
  }
`;

export const splitCategoryLimitsMutation = /* GraphQL */ `
  mutation SplitCategoryLimits($budgetId: ID!) {
    splitCategoryLimits(budgetId: $budgetId) {
      id
    }
  }
`;

export const updateProfileMutation = /* GraphQL */ `
  mutation UpdateProfile($input: UpdateProfileInput!) {
    updateProfile(input: $input) {
      id
      displayName
      baseCurrency
      locale
    }
  }
`;
