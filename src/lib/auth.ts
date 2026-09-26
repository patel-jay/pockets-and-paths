import type { Profile } from '../types/app';

export const demoCredentials = {
  email: 'demo@pocketsandpaths.app',
  password: 'pathfinder',
} as const;

export type AuthMode = 'account' | 'demo';

export type AuthSession =
  | { authenticated: false }
  | {
      authenticated: true;
      mode: AuthMode;
      email?: string;
      profile: Profile;
    };

export type AuthConfig = {
  demoEnabled: boolean;
  personalAccountsEnabled: boolean;
  registrationEnabled: boolean;
  turnstileSiteKey: string | null;
};

export type RegistrationInput = {
  displayName: string;
  email: string;
  password: string;
  inviteCode: string;
  turnstileToken: string;
};

export type AccountSessionSummary = {
  current: boolean;
  createdAt: string;
  expiresAt: number;
  userAgent: string | null;
};

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'Your session could not be updated.');
  return result;
}

export function getAuthConfig(): Promise<AuthConfig> {
  return authRequest('/api/auth/config');
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

export function loginToAccount(email: string, password: string): Promise<AuthSession> {
  return authRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function registerAccount(input: RegistrationInput): Promise<AuthSession> {
  return authRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logout(): Promise<AuthSession> {
  return authRequest('/api/auth/logout', { method: 'POST', body: '{}' });
}

export function resetDemo(): Promise<{ reset: true }> {
  return authRequest('/api/auth/reset', { method: 'POST', body: '{}' });
}

export function getAccountSessions(): Promise<{ sessions: AccountSessionSummary[] }> {
  return authRequest('/api/auth/sessions');
}

export function logoutOtherSessions(): Promise<{ revoked: number }> {
  return authRequest('/api/auth/logout-others', { method: 'POST', body: '{}' });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ changed: true; otherSessionsRevoked: true }> {
  return authRequest('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
