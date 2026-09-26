import { GraphQLError } from 'graphql';
import { createYoga, maskError } from 'graphql-yoga';
import { hashPassword, secureStringEqual, verifyPassword } from './auth/crypto';
import {
  clearExpiredSessions,
  clearRateLimit,
  clearStaleRateLimits,
  createAccount,
  createAccountSession,
  deleteAccountSession,
  deleteOtherAccountSessions,
  findAccountById,
  findAccountByEmail,
  getAccountSession,
  listAccountSessions,
  takeRateLimit,
  updateAccountPassword,
} from './auth/store';
import { registrationConfigured, verifyTurnstile } from './auth/turnstile';
import { clientAddress, normalizeEmail, validPassword } from './auth/validation';
import {
  ensureViewer,
  expensesCsv,
  exportViewerData,
  getProfile,
  resetViewer,
  viewerExists,
} from './data';
import { requireText } from './data/validation';
import { DomainError } from './errors';
import { schema } from './graphql/schema';
import type { Env, ProfileRow, RequestContext } from './types';

const DEMO_SESSION_COOKIE = 'pp_session';
const DEMO_AUTH_COOKIE = 'pp_demo_auth';
const ACCOUNT_SESSION_COOKIE = 'pp_account_session';
const DEMO_EMAIL = 'demo@pocketsandpaths.app';
const DEMO_PASSWORD = 'pathfinder';

type RequestIdentity = {
  viewerId: string;
  mode: 'account' | 'demo';
  profile: ProfileRow;
  email?: string;
  accountToken?: string;
};

function readCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  return (
    cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? null
  );
}

function readDemoSessionId(request: Request): string | null {
  const session = readCookie(request, DEMO_SESSION_COOKIE);
  return session && /^[a-f0-9-]{36}$/i.test(session) ? session : null;
}

function cookieAttributes(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function setCookie(
  headers: Headers,
  request: Request,
  name: string,
  value: string,
  maxAge: number,
): void {
  headers.append('Set-Cookie', `${name}=${value}; ${cookieAttributes(request)}; Max-Age=${maxAge}`);
}

function clearCookie(headers: Headers, request: Request, name: string): void {
  setCookie(headers, request, name, '', 0);
}

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function profileJson(profile: ProfileRow) {
  return {
    id: profile.viewer_id,
    displayName: profile.display_name,
    defaultCurrency: profile.base_currency,
    locale: profile.locale,
  };
}

function sessionJson(identity: RequestIdentity) {
  return {
    authenticated: true,
    mode: identity.mode,
    email: identity.email,
    profile: profileJson(identity.profile),
  };
}

async function getIdentity(request: Request, env: Env): Promise<RequestIdentity | null> {
  const accountToken = readCookie(request, ACCOUNT_SESSION_COOKIE);
  if (accountToken) {
    const session = await getAccountSession(env.DB, accountToken);
    if (session) {
      return {
        viewerId: session.viewerId,
        mode: 'account',
        email: session.email,
        accountToken,
        profile: session.profile,
      };
    }
  }

  const viewerId = readDemoSessionId(request);
  const authenticated = readCookie(request, DEMO_AUTH_COOKIE) === '1';
  if (!viewerId || !authenticated || !(await viewerExists(env.DB, viewerId))) return null;
  return { viewerId, mode: 'demo', profile: await getProfile(env.DB, viewerId) };
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function rateLimited(retryAfterSeconds: number): Response {
  return json(
    { error: 'Too many attempts. Please wait a little while and try again.' },
    { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
  );
}

const yoga = createYoga<RequestContext>({
  schema,
  graphqlEndpoint: '/graphql',
  graphiql: false,
  maskedErrors: {
    maskError: (error, message, isDev) => {
      const graphQLError = error instanceof GraphQLError ? error : null;
      const originalError = graphQLError?.originalError ?? error;
      if (originalError instanceof DomainError) {
        return new GraphQLError(originalError.message, {
          nodes: graphQLError?.nodes,
          path: graphQLError?.path,
          extensions: { code: originalError.code },
        });
      }
      return maskError(error, message, isDev);
    },
  },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok' });
    }

    if (url.pathname === '/api/auth/config' && request.method === 'GET') {
      const configured = registrationConfigured(env);
      return json({
        demoEnabled: env.DEMO_ENABLED !== 'false',
        personalAccountsEnabled: Boolean(env.AUTH_PEPPER),
        registrationEnabled: configured,
        turnstileSiteKey: configured ? env.TURNSTILE_SITE_KEY : null,
      });
    }

    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const identity = await getIdentity(request, env);
      return identity ? json(sessionJson(identity)) : json({ authenticated: false });
    }

    if (url.pathname === '/api/auth/demo-login' && request.method === 'POST') {
      if (!sameOrigin(request)) {
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      }
      if (env.DEMO_ENABLED === 'false') {
        return json({ error: 'Demo access is disabled.' }, { status: 404 });
      }
      const credentials = await readJson<{ email?: string; password?: string }>(request);
      if (!credentials) {
        return json({ error: 'Enter the demo account credentials.' }, { status: 400 });
      }
      if (
        credentials.email?.toLowerCase() !== DEMO_EMAIL ||
        credentials.password !== DEMO_PASSWORD
      ) {
        return json({ error: 'Those demo credentials do not match.' }, { status: 401 });
      }

      const accountToken = readCookie(request, ACCOUNT_SESSION_COOKIE);
      if (accountToken) await deleteAccountSession(env.DB, accountToken);
      const viewerId = readDemoSessionId(request) ?? crypto.randomUUID();
      await ensureViewer(env.DB, viewerId);
      const identity: RequestIdentity = {
        viewerId,
        mode: 'demo',
        profile: await getProfile(env.DB, viewerId),
      };
      const headers = new Headers();
      setCookie(headers, request, DEMO_SESSION_COOKIE, viewerId, 31_536_000);
      setCookie(headers, request, DEMO_AUTH_COOKIE, '1', 86_400);
      clearCookie(headers, request, ACCOUNT_SESSION_COOKIE);
      return json(sessionJson(identity), { headers });
    }

    if (url.pathname === '/api/auth/login' && request.method === 'POST') {
      if (!sameOrigin(request)) {
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      }
      if (!env.AUTH_PEPPER) {
        return json({ error: 'Personal accounts are not configured yet.' }, { status: 503 });
      }

      const credentials = await readJson<{ email?: unknown; password?: unknown }>(request);
      const email = normalizeEmail(credentials?.email);
      const password = typeof credentials?.password === 'string' ? credentials.password : '';
      if (!email || !password || password.length > 128) {
        return json({ error: 'Email or password is incorrect.' }, { status: 401 });
      }

      const address = clientAddress(request);
      const accountLimitKey = `login-account:${email}`;
      const addressLimitKey = `login-address:${address}`;
      await clearStaleRateLimits(env.DB);
      const [accountLimit, addressLimit] = await Promise.all([
        takeRateLimit(env.DB, accountLimitKey, {
          limit: 8,
          windowMs: 15 * 60 * 1000,
          blockMs: 15 * 60 * 1000,
        }),
        takeRateLimit(env.DB, addressLimitKey, {
          limit: 20,
          windowMs: 15 * 60 * 1000,
          blockMs: 15 * 60 * 1000,
        }),
      ]);
      if (!accountLimit.allowed || !addressLimit.allowed) {
        return rateLimited(
          Math.max(accountLimit.retryAfterSeconds, addressLimit.retryAfterSeconds),
        );
      }

      const account = await findAccountByEmail(env.DB, email);
      let passwordMatches = false;
      if (account) {
        passwordMatches = await verifyPassword(password, account.password_hash, env.AUTH_PEPPER);
      } else {
        // Keep unknown-account responses close to the same cost as a real password check.
        await hashPassword(password, env.AUTH_PEPPER);
      }
      if (!account || !passwordMatches) {
        return json({ error: 'Email or password is incorrect.' }, { status: 401 });
      }

      await Promise.all([clearRateLimit(env.DB, accountLimitKey), clearExpiredSessions(env.DB)]);
      const session = await createAccountSession(
        env.DB,
        account.id,
        request.headers.get('user-agent'),
      );
      const profile = await getProfile(env.DB, account.id);
      const headers = new Headers();
      setCookie(headers, request, ACCOUNT_SESSION_COOKIE, session.token, session.maxAge);
      clearCookie(headers, request, DEMO_AUTH_COOKIE);
      return json(
        sessionJson({ viewerId: account.id, mode: 'account', email: account.email, profile }),
        { headers },
      );
    }

    if (url.pathname === '/api/auth/register' && request.method === 'POST') {
      if (!sameOrigin(request)) {
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      }
      if (!registrationConfigured(env)) {
        return json(
          { error: 'Personal account registration is not configured yet.' },
          { status: 503 },
        );
      }

      const limitKey = `register:${clientAddress(request)}`;
      await clearStaleRateLimits(env.DB);
      const limit = await takeRateLimit(env.DB, limitKey, {
        limit: 5,
        windowMs: 60 * 60 * 1000,
        blockMs: 60 * 60 * 1000,
      });
      if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

      const input = await readJson<{
        displayName?: unknown;
        email?: unknown;
        password?: unknown;
        inviteCode?: unknown;
        turnstileToken?: unknown;
      }>(request);
      const email = normalizeEmail(input?.email);
      const inviteCode = typeof input?.inviteCode === 'string' ? input.inviteCode : '';
      const turnstileToken = typeof input?.turnstileToken === 'string' ? input.turnstileToken : '';
      let displayName: string;
      try {
        displayName = requireText(
          typeof input?.displayName === 'string' ? input.displayName : '',
          'Display name',
          60,
        );
      } catch {
        return json({ error: 'Enter a display name of up to 60 characters.' }, { status: 400 });
      }
      if (!email) return json({ error: 'Enter a valid email address.' }, { status: 400 });
      if (!validPassword(input?.password)) {
        return json({ error: 'Use a password between 12 and 128 characters.' }, { status: 400 });
      }
      if (!(await verifyTurnstile(request, env, turnstileToken))) {
        return json({ error: 'Human verification failed. Please try again.' }, { status: 400 });
      }
      if (
        !env.REGISTRATION_INVITE_CODE ||
        !(await secureStringEqual(inviteCode, env.REGISTRATION_INVITE_CODE))
      ) {
        return json({ error: 'The registration invite code is not valid.' }, { status: 403 });
      }
      if (await findAccountByEmail(env.DB, email)) {
        return json({ error: 'An account with this email already exists.' }, { status: 409 });
      }

      const accountId = crypto.randomUUID();
      const passwordHash = await hashPassword(input.password, env.AUTH_PEPPER!);
      try {
        await createAccount(env.DB, {
          id: accountId,
          email,
          passwordHash,
          displayName,
        });
      } catch {
        return json({ error: 'An account with this email already exists.' }, { status: 409 });
      }

      await clearExpiredSessions(env.DB);
      const session = await createAccountSession(
        env.DB,
        accountId,
        request.headers.get('user-agent'),
      );
      const profile = await getProfile(env.DB, accountId);
      const headers = new Headers();
      setCookie(headers, request, ACCOUNT_SESSION_COOKIE, session.token, session.maxAge);
      clearCookie(headers, request, DEMO_AUTH_COOKIE);
      return json(sessionJson({ viewerId: accountId, mode: 'account', email, profile }), {
        status: 201,
        headers,
      });
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      if (!sameOrigin(request)) {
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      }
      const accountToken = readCookie(request, ACCOUNT_SESSION_COOKIE);
      if (accountToken) await deleteAccountSession(env.DB, accountToken);
      const headers = new Headers();
      clearCookie(headers, request, DEMO_AUTH_COOKIE);
      clearCookie(headers, request, ACCOUNT_SESSION_COOKIE);
      return json({ authenticated: false }, { headers });
    }

    if (url.pathname === '/api/auth/sessions' && request.method === 'GET') {
      const identity = await getIdentity(request, env);
      if (!identity || identity.mode !== 'account' || !identity.accountToken) {
        return json({ error: 'Sign in to your personal account to continue.' }, { status: 403 });
      }
      return json({
        sessions: await listAccountSessions(env.DB, identity.viewerId, identity.accountToken),
      });
    }

    if (url.pathname === '/api/auth/logout-others' && request.method === 'POST') {
      if (!sameOrigin(request)) {
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      }
      const identity = await getIdentity(request, env);
      if (!identity || identity.mode !== 'account' || !identity.accountToken) {
        return json({ error: 'Sign in to your personal account to continue.' }, { status: 403 });
      }
      const revoked = await deleteOtherAccountSessions(
        env.DB,
        identity.viewerId,
        identity.accountToken,
      );
      return json({ revoked });
    }

    if (url.pathname === '/api/auth/change-password' && request.method === 'POST') {
      if (!sameOrigin(request)) {
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      }
      if (!env.AUTH_PEPPER) {
        return json({ error: 'Personal accounts are not configured yet.' }, { status: 503 });
      }
      const identity = await getIdentity(request, env);
      if (!identity || identity.mode !== 'account' || !identity.accountToken) {
        return json({ error: 'Sign in to your personal account to continue.' }, { status: 403 });
      }
      const input = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(request);
      const currentPassword =
        typeof input?.currentPassword === 'string' ? input.currentPassword : '';
      if (!validPassword(input?.newPassword) || !currentPassword || currentPassword.length > 128) {
        return json(
          { error: 'Check the current password and use 12–128 characters for the new password.' },
          { status: 400 },
        );
      }
      const passwordLimitKey = `change-password:${identity.viewerId}:${clientAddress(request)}`;
      const passwordLimit = await takeRateLimit(env.DB, passwordLimitKey, {
        limit: 6,
        windowMs: 15 * 60 * 1000,
        blockMs: 15 * 60 * 1000,
      });
      if (!passwordLimit.allowed) return rateLimited(passwordLimit.retryAfterSeconds);
      const account = await findAccountById(env.DB, identity.viewerId);
      if (
        !account ||
        !(await verifyPassword(currentPassword, account.password_hash, env.AUTH_PEPPER))
      ) {
        return json({ error: 'The current password is incorrect.' }, { status: 401 });
      }
      const passwordHash = await hashPassword(input.newPassword, env.AUTH_PEPPER);
      await updateAccountPassword(env.DB, identity.viewerId, passwordHash, identity.accountToken);
      await clearRateLimit(env.DB, passwordLimitKey);
      return json({ changed: true, otherSessionsRevoked: true });
    }

    if (url.pathname === '/api/auth/reset' && request.method === 'POST') {
      if (!sameOrigin(request)) {
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      }
      const identity = await getIdentity(request, env);
      if (!identity || identity.mode !== 'demo') {
        return json({ error: 'Only a demo session can be reset.' }, { status: 403 });
      }
      await resetViewer(env.DB, identity.viewerId);
      return json({ reset: true });
    }

    if (url.pathname === '/api/export' && request.method === 'GET') {
      const identity = await getIdentity(request, env);
      if (!identity) return json({ error: 'Sign in to continue.' }, { status: 401 });
      const exported = await exportViewerData(env.DB, identity.viewerId);
      const date = new Date().toISOString().slice(0, 10);
      if (url.searchParams.get('format') === 'csv') {
        return new Response(expensesCsv(exported.expenses as Record<string, unknown>[]), {
          headers: {
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="pockets-and-paths-expenses-${date}.csv"`,
            'cache-control': 'no-store',
          },
        });
      }
      return new Response(JSON.stringify(exported, null, 2), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="pockets-and-paths-backup-${date}.json"`,
          'cache-control': 'no-store',
        },
      });
    }

    if (url.pathname === '/graphql') {
      const identity = await getIdentity(request, env);
      if (!identity) {
        return json({ errors: [{ message: 'Sign in to continue.' }] }, { status: 401 });
      }
      const response = await yoga.fetch(request, { env, viewerId: identity.viewerId });
      const headers = new Headers(response.headers);

      // Normalize Yoga's Response subclass for workerd before returning it.
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
