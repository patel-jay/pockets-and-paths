import type { Profile } from '../types/app';

export const demoCredentials = {
  email: 'demo@pocketsandpaths.app',
  password: 'pathfinder',
} as const;

export type AuthSession = { authenticated: false } | { authenticated: true; profile: Profile };

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The demo session could not be updated.');
  return result;
}

export function getAuthSession(): Promise<AuthSession> {
  return authRequest('/api/auth/session');
}

export function loginToDemo(email: string, password: string): Promise<AuthSession> {
  return authRequest('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logoutOfDemo(): Promise<AuthSession> {
  return authRequest('/api/auth/logout', { method: 'POST', body: '{}' });
}

export function resetDemo(): Promise<{ reset: true }> {
  return authRequest('/api/auth/reset', { method: 'POST', body: '{}' });
}
