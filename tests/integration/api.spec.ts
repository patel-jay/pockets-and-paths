import { expect, test, type APIRequestContext } from '@playwright/test';

const DEMO_CREDENTIALS = {
  email: 'demo@pocketsandpaths.app',
  password: 'pathfinder',
};

type GraphQLBody<T> = {
  data?: T;
  errors?: { message: string }[];
};

async function login(api: APIRequestContext) {
  const response = await api.post('/api/auth/demo-login', { data: DEMO_CREDENTIALS });
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({ authenticated: true });
}

async function reset(api: APIRequestContext) {
  const response = await api.post('/api/auth/reset', { data: {} });
  expect(response.ok()).toBe(true);
}

async function graphql<T>(
  api: APIRequestContext,
  query: string,
  variables?: Record<string, unknown>,
): Promise<GraphQLBody<T>> {
  const response = await api.post('/graphql', { data: { query, variables } });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<GraphQLBody<T>>;
}

const budgetsQuery = `
  query IntegrationBudgets {
    budgets {
      id
      name
      currency
      amount { minor currency }
      spent { minor currency }
      progress
      isOverBudget
      overspent { minor currency }
      categories { id name hasLimit }
    }
  }
`;

test('keeps each browser viewer isolated across database queries and mutations', async ({
  playwright,
}) => {
  const viewerA = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const viewerB = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });

  try {
    await Promise.all([login(viewerA), login(viewerB)]);
    await Promise.all([reset(viewerA), reset(viewerB)]);

    const uniqueName = `Private plan ${Date.now()}`;
    const created = await graphql<{ createBudget: { id: string } }>(
      viewerA,
      `
        mutation CreateIntegrationBudget($input: CreateBudgetInput!) {
          createBudget(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          name: uniqueName,
          type: 'MONTHLY',
          currency: 'INR',
          amountMinor: '250000',
          startDate: '2031-01-01',
          endDate: null,
        },
      },
    );
    expect(created.errors).toBeUndefined();

    const [a, b] = await Promise.all([
      graphql<{ budgets: { name: string }[] }>(viewerA, budgetsQuery),
      graphql<{ budgets: { name: string }[] }>(viewerB, budgetsQuery),
    ]);
    expect(a.data?.budgets.some((budget) => budget.name === uniqueName)).toBe(true);
    expect(b.data?.budgets.some((budget) => budget.name === uniqueName)).toBe(false);
  } finally {
    await Promise.all([viewerA.dispose(), viewerB.dispose()]);
  }
});

test('rejects a category owned by another viewer', async ({ playwright }) => {
  const viewerA = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const viewerB = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });

  try {
    await Promise.all([login(viewerA), login(viewerB)]);
    await Promise.all([reset(viewerA), reset(viewerB)]);
    const [a, b] = await Promise.all([
      graphql<{
        budgets: { id: string; categories: { id: string }[] }[];
      }>(viewerA, budgetsQuery),
      graphql<{
        budgets: { id: string; categories: { id: string }[] }[];
      }>(viewerB, budgetsQuery),
    ]);

    const foreignCategoryId = a.data!.budgets[0].categories[0].id;
    const ownBudgetId = b.data!.budgets[0].id;
    const result = await graphql(
      viewerB,
      `
        mutation ForeignCategory($input: ExpenseImpactInput!) {
          previewExpense(input: $input) {
            budgetWillOverspend
          }
        }
      `,
      {
        input: {
          budgetId: ownBudgetId,
          categoryId: foreignCategoryId,
          amountMinor: '10000',
        },
      },
    );

    expect(result.data).toBeNull();
    expect(result.errors?.[0]?.message).toContain('Category does not belong');
  } finally {
    await Promise.all([viewerA.dispose(), viewerB.dispose()]);
  }
});

test('previews and records an expense beyond the overall budget', async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });

  try {
    await login(api);
    await reset(api);
    const initial = await graphql<{
      budgets: { id: string; currency: string; categories: { id: string }[] }[];
    }>(api, budgetsQuery);
    const budget = initial.data!.budgets[0];
    const input = {
      budgetId: budget.id,
      categoryId: budget.categories[0].id,
      title: 'Emergency rebooking',
      amountMinor: '50000000',
      expenseDate: '2031-01-15',
      notes: 'Integration test expense',
    };

    const previewInput = {
      budgetId: input.budgetId,
      categoryId: input.categoryId,
      amountMinor: input.amountMinor,
    };
    const preview = await graphql<{
      previewExpense: { budgetWillOverspend: boolean; budgetOverspent: { minor: string } };
    }>(
      api,
      `
        mutation PreviewIntegrationExpense($input: ExpenseImpactInput!) {
          previewExpense(input: $input) {
            budgetWillOverspend
            budgetOverspent {
              minor
            }
          }
        }
      `,
      { input: previewInput },
    );
    expect(preview.data?.previewExpense.budgetWillOverspend).toBe(true);
    expect(Number(preview.data?.previewExpense.budgetOverspent.minor)).toBeGreaterThan(0);

    const added = await graphql<{
      addExpense: { id: string; amount: { minor: string; currency: string } };
    }>(
      api,
      `
        mutation AddIntegrationExpense($input: AddExpenseInput!) {
          addExpense(input: $input) {
            id
            amount {
              minor
              currency
            }
          }
        }
      `,
      { input },
    );
    expect(added.errors).toBeUndefined();
    expect(added.data?.addExpense.amount).toEqual({
      minor: input.amountMinor,
      currency: budget.currency,
    });

    const updated = await graphql<{
      budgets: {
        id: string;
        progress: number;
        isOverBudget: boolean;
        overspent: { minor: string };
      }[];
    }>(api, budgetsQuery);
    const updatedBudget = updated.data!.budgets.find((candidate) => candidate.id === budget.id)!;
    expect(updatedBudget.isOverBudget).toBe(true);
    expect(updatedBudget.progress).toBeGreaterThan(100);
    expect(Number(updatedBudget.overspent.minor)).toBeGreaterThan(0);
  } finally {
    await api.dispose();
  }
});
