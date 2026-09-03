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
      type
      status
      phase
      currency
      startDate
      endDate
      amount { minor currency }
      spent { minor currency }
      progress
      isOverBudget
      overspent { minor currency }
      categories { id name hasLimit }
    }
  }
`;

test('updates, archives, and restores a budget without losing its history', async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });

  try {
    await login(api);
    await reset(api);
    const initial = await graphql<{
      budgets: {
        id: string;
        type: 'MONTHLY' | 'TEMPORARY';
        categories: { id: string }[];
      }[];
    }>(api, budgetsQuery);
    const temporaryBudget = initial.data!.budgets.find((budget) => budget.type === 'TEMPORARY')!;

    const updated = await graphql<{
      updateBudget: {
        id: string;
        name: string;
        amount: { minor: string };
        startDate: string;
        endDate: string;
        phase: string;
      };
    }>(
      api,
      `
        mutation UpdateIntegrationBudget($input: UpdateBudgetInput!) {
          updateBudget(input: $input) {
            id
            name
            amount {
              minor
            }
            startDate
            endDate
            phase
          }
        }
      `,
      {
        input: {
          budgetId: temporaryBudget.id,
          name: 'Kyoto spring journey',
          amountMinor: '410000',
          startDate: '2031-03-10',
          endDate: '2031-03-24',
        },
      },
    );
    expect(updated.errors).toBeUndefined();
    expect(updated.data?.updateBudget).toMatchObject({
      name: 'Kyoto spring journey',
      amount: { minor: '410000' },
      startDate: '2031-03-10',
      endDate: '2031-03-24',
      phase: 'UPCOMING',
    });

    const archived = await graphql<{ archiveBudget: { id: string; status: string } }>(
      api,
      `
        mutation ArchiveIntegrationBudget($id: ID!) {
          archiveBudget(id: $id) {
            id
            status
          }
        }
      `,
      { id: temporaryBudget.id },
    );
    expect(archived.data?.archiveBudget.status).toBe('ARCHIVED');

    const [openBudgets, archivedBudgets] = await Promise.all([
      graphql<{ budgets: { id: string }[] }>(api, budgetsQuery),
      graphql<{ budgets: { id: string; status: string }[] }>(
        api,
        `
          query ArchivedIntegrationBudgets {
            budgets(status: ARCHIVED) {
              id
              status
            }
          }
        `,
      ),
    ]);
    expect(openBudgets.data?.budgets.some((budget) => budget.id === temporaryBudget.id)).toBe(
      false,
    );
    expect(archivedBudgets.data?.budgets).toContainEqual({
      id: temporaryBudget.id,
      status: 'ARCHIVED',
    });

    const dashboard = await graphql<{
      dashboard: {
        openBudgets: { id: string }[];
        recentExpenses: { budgetId: string }[];
      };
    }>(
      api,
      `
        query DashboardWithoutArchivedBudget {
          dashboard {
            openBudgets {
              id
            }
            recentExpenses {
              budgetId
            }
          }
        }
      `,
    );
    expect(
      dashboard.data?.dashboard.openBudgets.some((budget) => budget.id === temporaryBudget.id),
    ).toBe(false);
    expect(
      dashboard.data?.dashboard.recentExpenses.some(
        (expense) => expense.budgetId === temporaryBudget.id,
      ),
    ).toBe(false);

    const blockedUpdate = await graphql(
      api,
      `
        mutation UpdateArchivedBudget($input: UpdateBudgetInput!) {
          updateBudget(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          budgetId: temporaryBudget.id,
          name: 'Should not change',
          amountMinor: '410000',
          startDate: '2031-03-10',
          endDate: '2031-03-24',
        },
      },
    );
    expect(blockedUpdate.errors?.[0]?.message).toContain('Restore this budget');

    const blockedExpense = await graphql(
      api,
      `
        mutation PreviewArchivedExpense($input: ExpenseImpactInput!) {
          previewExpense(input: $input) {
            budgetWillOverspend
          }
        }
      `,
      {
        input: {
          budgetId: temporaryBudget.id,
          categoryId: temporaryBudget.categories[0].id,
          amountMinor: '1000',
        },
      },
    );
    expect(blockedExpense.errors?.[0]?.message).toContain('Restore this budget');

    const restored = await graphql<{ restoreBudget: { status: string } }>(
      api,
      `
        mutation RestoreIntegrationBudget($id: ID!) {
          restoreBudget(id: $id) {
            status
          }
        }
      `,
      { id: temporaryBudget.id },
    );
    expect(restored.data?.restoreBudget.status).toBe('ACTIVE');
    const reopened = await graphql<{ budgets: { id: string }[] }>(api, budgetsQuery);
    expect(reopened.data?.budgets.some((budget) => budget.id === temporaryBudget.id)).toBe(true);
  } finally {
    await api.dispose();
  }
});

test('keeps every seeded expense attached to a category in its budget', async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });

  try {
    await login(api);
    await reset(api);
    const result = await graphql<{
      budgets: {
        name: string;
        phase: 'ACTIVE' | 'UPCOMING' | 'ENDED';
        categories: { id: string; name: string; icon: string }[];
        expenses: {
          title: string;
          categoryId: string;
          categoryName: string;
          categoryIcon: string;
        }[];
      }[];
      dashboard: {
        openBudgets: { name: string; phase: 'ACTIVE' | 'UPCOMING' }[];
        recentExpenses: { categoryName: string }[];
      };
    }>(
      api,
      `
        query SeededExpenseCategories {
          budgets {
            name
            phase
            categories {
              id
              name
              icon
            }
            expenses {
              title
              categoryId
              categoryName
              categoryIcon
            }
          }
          dashboard {
            openBudgets {
              name
              phase
            }
            recentExpenses {
              categoryName
            }
          }
        }
      `,
    );

    expect(result.errors).toBeUndefined();
    const monthlyPlan = result.data!.budgets.find((budget) => budget.name.endsWith(' monthly'));
    const journeyPlan = result.data!.budgets.find((budget) => budget.name === 'Japan journey');
    expect(monthlyPlan?.phase).toBe('ACTIVE');
    expect(journeyPlan?.phase).toBe('UPCOMING');
    expect(result.data!.dashboard.openBudgets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: monthlyPlan?.name, phase: 'ACTIVE' }),
        expect.objectContaining({ name: 'Japan journey', phase: 'UPCOMING' }),
      ]),
    );

    for (const budget of result.data!.budgets) {
      const categories = new Map(budget.categories.map((category) => [category.id, category]));
      for (const expense of budget.expenses) {
        const category = categories.get(expense.categoryId);
        expect(category?.name).toBe(expense.categoryName);
        expect(category?.icon).toBe(expense.categoryIcon);
      }
    }

    const cinemaNight = result
      .data!.budgets.flatMap((budget) => budget.expenses)
      .find((expense) => expense.title === 'Cinema night');
    expect(cinemaNight?.categoryName).toBe('Leisure');
    expect(cinemaNight?.categoryIcon).toBe('entertainment');

    const recentCategories = result.data!.dashboard.recentExpenses.map(
      (expense) => expense.categoryName,
    );
    expect(new Set(recentCategories).size).toBe(recentCategories.length);
  } finally {
    await api.dispose();
  }
});

test('persists and validates a category icon choice', async ({ playwright }) => {
  const api = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4173' });

  try {
    await login(api);
    await reset(api);
    const initial = await graphql<{ budgets: { id: string }[] }>(api, budgetsQuery);
    const budgetId = initial.data!.budgets[0].id;
    const created = await graphql<{
      createCategory: { id: string; color: string; icon: string };
    }>(
      api,
      `
        mutation CreateIconCategory($input: CreateCategoryInput!) {
          createCategory(input: $input) {
            id
            color
            icon
          }
        }
      `,
      {
        input: {
          budgetId,
          name: 'Pet care',
          limitMinor: null,
          color: '#6382a8',
          icon: 'pets',
        },
      },
    );

    expect(created.errors).toBeUndefined();
    expect(created.data?.createCategory).toMatchObject({ color: '#6382a8', icon: 'pets' });

    const updated = await graphql<{
      updateCategory: { color: string; icon: string };
    }>(
      api,
      `
        mutation UpdateIconCategory($input: UpdateCategoryInput!) {
          updateCategory(input: $input) {
            color
            icon
          }
        }
      `,
      {
        input: {
          categoryId: created.data!.createCategory.id,
          limitMinor: null,
          color: '#e8795d',
          icon: 'health',
        },
      },
    );

    expect(updated.errors).toBeUndefined();
    expect(updated.data?.updateCategory).toEqual({ color: '#e8795d', icon: 'health' });

    const invalid = await graphql(
      api,
      `
        mutation InvalidIconCategory($input: CreateCategoryInput!) {
          createCategory(input: $input) {
            id
          }
        }
      `,
      {
        input: {
          budgetId,
          name: 'Invalid appearance',
          limitMinor: null,
          color: '#2e7064',
          icon: 'not-an-icon',
        },
      },
    );
    expect(invalid.data).toBeNull();
    expect(invalid.errors?.[0]?.message).toContain('supported category icon');
  } finally {
    await api.dispose();
  }
});

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
