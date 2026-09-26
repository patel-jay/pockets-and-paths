import { expect, test, type APIRequestContext } from '@playwright/test';

const INVITE_CODE = 'choose-a-private-local-invite-code';
const TURNSTILE_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const BASE_URL = 'http://127.0.0.1:4173';

function uniqueTestAddress(): string {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 16).match(/.{4}/g)!;
  return `2001:db8:${suffix.join(':')}`;
}

async function graphql<T>(
  api: APIRequestContext,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data?: T; errors?: { message: string }[] }> {
  const response = await api.post('/graphql', { data: { query, variables } });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ data?: T; errors?: { message: string }[] }>;
}

test('registers an invite-only personal account and restores it in a new session', async ({
  playwright,
}) => {
  const email = `owner-${Date.now()}-${crypto.randomUUID()}@example.com`;
  const password = 'a long integration passphrase';
  const accountAddress = uniqueTestAddress();
  const firstDevice = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'CF-Connecting-IP': accountAddress },
  });

  try {
    const registration = await firstDevice.post('/api/auth/register', {
      data: {
        displayName: 'Personal Owner',
        email,
        password,
        inviteCode: INVITE_CODE,
        turnstileToken: TURNSTILE_TEST_TOKEN,
      },
    });
    expect(registration.status()).toBe(201);
    await expect(registration.json()).resolves.toMatchObject({
      authenticated: true,
      mode: 'account',
      email,
      profile: { displayName: 'Personal Owner' },
    });

    const empty = await graphql<{ budgets: { id: string }[] }>(
      firstDevice,
      'query EmptyPersonalAccount { budgets { id } }',
    );
    expect(empty.errors).toBeUndefined();
    expect(empty.data?.budgets).toEqual([]);

    const created = await graphql<{ createBudget: { id: string; name: string } }>(
      firstDevice,
      `
        mutation CreatePersonalBudget($input: CreateBudgetInput!) {
          createBudget(input: $input) {
            id
            name
          }
        }
      `,
      {
        input: {
          name: 'Private monthly plan',
          type: 'MONTHLY',
          currency: 'INR',
          amountMinor: '100000',
          startDate: '2031-01-01',
          endDate: null,
        },
      },
    );
    expect(created.errors).toBeUndefined();

    const reset = await firstDevice.post('/api/auth/reset', { data: {} });
    expect(reset.status()).toBe(403);

    const logout = await firstDevice.post('/api/auth/logout', { data: {} });
    expect(logout.ok()).toBe(true);
  } finally {
    await firstDevice.dispose();
  }

  const secondDevice = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'CF-Connecting-IP': accountAddress },
  });
  try {
    const wrongPassword = await secondDevice.post('/api/auth/login', {
      data: { email, password: 'this is not the right password' },
    });
    expect(wrongPassword.status()).toBe(401);

    const login = await secondDevice.post('/api/auth/login', { data: { email, password } });
    expect(login.ok()).toBe(true);
    await expect(login.json()).resolves.toMatchObject({
      authenticated: true,
      mode: 'account',
      email,
    });

    const reopened = await graphql<{ budgets: { name: string }[] }>(
      secondDevice,
      'query ReopenedPersonalAccount { budgets { name } }',
    );
    expect(reopened.data?.budgets).toContainEqual({ name: 'Private monthly plan' });

    const sessions = await secondDevice.get('/api/auth/sessions');
    expect(sessions.ok()).toBe(true);
    await expect(sessions.json()).resolves.toMatchObject({
      sessions: [expect.objectContaining({ current: true })],
    });

    const exported = await secondDevice.get('/api/export?format=json');
    expect(exported.ok()).toBe(true);
    await expect(exported.json()).resolves.toMatchObject({
      formatVersion: 1,
      budgets: [expect.objectContaining({ name: 'Private monthly plan' })],
      budgetPeriods: [],
    });

    const nextPassword = 'an updated integration passphrase';
    const changed = await secondDevice.post('/api/auth/change-password', {
      data: { currentPassword: password, newPassword: nextPassword },
    });
    expect(changed.ok()).toBe(true);

    const logout = await secondDevice.post('/api/auth/logout', { data: {} });
    expect(logout.ok()).toBe(true);
    const oldLogin = await secondDevice.post('/api/auth/login', { data: { email, password } });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await secondDevice.post('/api/auth/login', {
      data: { email, password: nextPassword },
    });
    expect(newLogin.ok()).toBe(true);
  } finally {
    await secondDevice.dispose();
  }
});

test('atomically limits concurrent sign-in attempts', async ({ playwright }) => {
  const api = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'CF-Connecting-IP': '198.51.100.24' },
  });
  const email = `missing-${crypto.randomUUID()}@example.com`;

  try {
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        api.post('/api/auth/login', {
          data: { email, password: 'a wrong integration password' },
        }),
      ),
    );
    const statuses = responses.map((response) => response.status());

    expect(statuses.every((status) => status === 401 || status === 429)).toBe(true);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(4);
  } finally {
    await api.dispose();
  }
});

test('keeps successful registrations inside the address rate-limit window', async ({
  playwright,
}) => {
  const api = await playwright.request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { 'CF-Connecting-IP': uniqueTestAddress() },
  });

  try {
    const statuses: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await api.post('/api/auth/register', {
        data: {
          displayName: `Rate Limit Owner ${index}`,
          email: `rate-limit-${index}-${crypto.randomUUID()}@example.com`,
          password: 'a long integration passphrase',
          inviteCode: INVITE_CODE,
          turnstileToken: TURNSTILE_TEST_TOKEN,
        },
      });
      statuses.push(response.status());
    }

    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses[5]).toBe(429);
  } finally {
    await api.dispose();
  }
});
