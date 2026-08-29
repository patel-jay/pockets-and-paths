import { GraphQLError } from 'graphql';
import { createYoga, maskError } from 'graphql-yoga';
import { ensureViewer, getProfile, resetViewer, viewerExists } from './data';
import { DomainError } from './errors';
import { schema } from './graphql/schema';
import type { Env, RequestContext } from './types';

const SESSION_COOKIE = 'pp_session';
const AUTH_COOKIE = 'pp_demo_auth';
const DEMO_EMAIL = 'demo@pocketsandpaths.app';
const DEMO_PASSWORD = 'pathfinder';

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

function readSessionId(request: Request): string | null {
  const session = readCookie(request, SESSION_COOKIE);
  return session && /^[a-f0-9-]{36}$/i.test(session) ? session : null;
}

function cookieAttributes(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
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

    if (url.pathname === '/api/auth/session' && request.method === 'GET') {
      const viewerId = readSessionId(request);
      const authenticated = readCookie(request, AUTH_COOKIE) === '1';
      if (!viewerId || !authenticated || !(await viewerExists(env.DB, viewerId))) {
        return json({ authenticated: false });
      }
      const profile = await getProfile(env.DB, viewerId);
      return json({
        authenticated: true,
        profile: {
          id: profile.viewer_id,
          displayName: profile.display_name,
          baseCurrency: profile.base_currency,
          locale: profile.locale,
        },
      });
    }

    if (url.pathname === '/api/auth/demo-login' && request.method === 'POST') {
      if (!sameOrigin(request))
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      let credentials: { email?: string; password?: string };
      try {
        credentials = (await request.json()) as { email?: string; password?: string };
      } catch {
        return json({ error: 'Enter the demo account credentials.' }, { status: 400 });
      }
      if (
        credentials.email?.toLowerCase() !== DEMO_EMAIL ||
        credentials.password !== DEMO_PASSWORD
      ) {
        return json({ error: 'Those demo credentials do not match.' }, { status: 401 });
      }

      const viewerId = readSessionId(request) ?? crypto.randomUUID();
      await ensureViewer(env.DB, viewerId);
      const profile = await getProfile(env.DB, viewerId);
      const headers = new Headers();
      const attributes = cookieAttributes(request);
      headers.append(
        'Set-Cookie',
        `${SESSION_COOKIE}=${viewerId}; ${attributes}; Max-Age=31536000`,
      );
      headers.append('Set-Cookie', `${AUTH_COOKIE}=1; ${attributes}; Max-Age=86400`);
      return json(
        {
          authenticated: true,
          profile: {
            id: profile.viewer_id,
            displayName: profile.display_name,
            baseCurrency: profile.base_currency,
            locale: profile.locale,
          },
        },
        { headers },
      );
    }

    if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
      if (!sameOrigin(request))
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      const headers = new Headers();
      headers.append('Set-Cookie', `${AUTH_COOKIE}=; ${cookieAttributes(request)}; Max-Age=0`);
      return json({ authenticated: false }, { headers });
    }

    if (url.pathname === '/api/auth/reset' && request.method === 'POST') {
      if (!sameOrigin(request))
        return json({ error: 'Cross-origin request rejected.' }, { status: 403 });
      const viewerId = readSessionId(request);
      if (!viewerId || readCookie(request, AUTH_COOKIE) !== '1') {
        return json({ error: 'Sign in to reset the demo.' }, { status: 401 });
      }
      await resetViewer(env.DB, viewerId);
      return json({ reset: true });
    }

    if (url.pathname === '/graphql') {
      const viewerId = readSessionId(request);
      if (!viewerId || readCookie(request, AUTH_COOKIE) !== '1') {
        return json({ errors: [{ message: 'Sign in to continue.' }] }, { status: 401 });
      }
      const response = await yoga.fetch(request, { env, viewerId });
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
