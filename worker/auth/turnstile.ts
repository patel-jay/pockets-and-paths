import type { Env } from '../types';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ALWAYS_PASS_TEST_SECRET = '1x0000000000000000000000000000000AA';

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
};

export function registrationConfigured(env: Env): boolean {
  return Boolean(
    env.REGISTRATION_ENABLED === 'true' &&
    env.AUTH_PEPPER &&
    env.REGISTRATION_INVITE_CODE &&
    env.TURNSTILE_SITE_KEY &&
    env.TURNSTILE_SECRET_KEY,
  );
}

export async function verifyTurnstile(request: Request, env: Env, token: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY || token.length === 0 || token.length > 2048) return false;

  const body = new FormData();
  body.set('secret', env.TURNSTILE_SECRET_KEY);
  body.set('response', token);
  body.set('idempotency_key', crypto.randomUUID());
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.set('remoteip', ip);

  try {
    const response = await fetch(VERIFY_URL, { method: 'POST', body });
    if (!response.ok) return false;
    const result = (await response.json()) as TurnstileResponse;
    if (!result.success) return false;

    const usingTestKey = env.TURNSTILE_SECRET_KEY === ALWAYS_PASS_TEST_SECRET;
    if (!usingTestKey) {
      const requestHost = new URL(request.url).hostname;
      if (result.hostname !== requestHost || result.action !== 'register') return false;
    }
    return true;
  } catch {
    return false;
  }
}
