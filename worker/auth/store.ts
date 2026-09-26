import type { ProfileRow } from '../types';
import { createSessionToken, hashToken } from './crypto';

const SESSION_SECONDS = 60 * 60 * 24 * 30;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface AccountSession {
  viewerId: string;
  email: string;
  profile: ProfileRow;
}

type SessionRow = ProfileRow & {
  account_id: string;
  email: string;
};

type RateLimitRow = {
  attempts: number;
  window_started_at: number;
  blocked_until: number;
};

export async function findAccountByEmail(
  db: D1Database,
  email: string,
): Promise<AccountRow | null> {
  return db.prepare('SELECT * FROM accounts WHERE email = ?').bind(email).first<AccountRow>();
}

export async function findAccountById(db: D1Database, id: string): Promise<AccountRow | null> {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').bind(id).first<AccountRow>();
}

export async function createAccount(
  db: D1Database,
  input: { id: string; email: string; passwordHash: string; displayName: string },
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO profiles (viewer_id, display_name, base_currency, locale, created_at)
         VALUES (?, ?, 'INR', 'en-IN', ?)`,
      )
      .bind(input.id, input.displayName, timestamp),
    db
      .prepare(
        `INSERT INTO accounts (id, email, password_hash, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(input.id, input.email, input.passwordHash, timestamp),
  ]);
}

export async function createAccountSession(
  db: D1Database,
  accountId: string,
  userAgent?: string | null,
): Promise<{ token: string; maxAge: number }> {
  const token = createSessionToken();
  const tokenHash = await hashToken(token);
  const now = Date.now();
  const expiresAt = now + SESSION_SECONDS * 1000;
  await db
    .prepare(
      `INSERT INTO account_sessions (token_hash, account_id, expires_at, created_at, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      tokenHash,
      accountId,
      expiresAt,
      new Date(now).toISOString(),
      userAgent?.slice(0, 200) ?? null,
    )
    .run();
  return { token, maxAge: SESSION_SECONDS };
}

export async function listAccountSessions(
  db: D1Database,
  accountId: string,
  currentToken: string,
): Promise<
  Array<{ current: boolean; createdAt: string; expiresAt: number; userAgent: string | null }>
> {
  const currentHash = await hashToken(currentToken);
  const { results } = await db
    .prepare(
      `SELECT token_hash, created_at, expires_at, user_agent
       FROM account_sessions
       WHERE account_id = ? AND expires_at > ?
       ORDER BY created_at DESC`,
    )
    .bind(accountId, Date.now())
    .all<{
      token_hash: string;
      created_at: string;
      expires_at: number;
      user_agent: string | null;
    }>();
  return results.map((session) => ({
    current: session.token_hash === currentHash,
    createdAt: session.created_at,
    expiresAt: session.expires_at,
    userAgent: session.user_agent,
  }));
}

export async function deleteOtherAccountSessions(
  db: D1Database,
  accountId: string,
  currentToken: string,
): Promise<number> {
  const result = await db
    .prepare('DELETE FROM account_sessions WHERE account_id = ? AND token_hash <> ?')
    .bind(accountId, await hashToken(currentToken))
    .run();
  return result.meta.changes;
}

export async function updateAccountPassword(
  db: D1Database,
  accountId: string,
  passwordHash: string,
  currentToken: string,
): Promise<void> {
  await db.batch([
    db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').bind(passwordHash, accountId),
    db
      .prepare('DELETE FROM account_sessions WHERE account_id = ? AND token_hash <> ?')
      .bind(accountId, await hashToken(currentToken)),
  ]);
}

export async function getAccountSession(
  db: D1Database,
  token: string,
): Promise<AccountSession | null> {
  const tokenHash = await hashToken(token);
  const row = await db
    .prepare(
      `SELECT
         s.account_id,
         a.email,
         p.viewer_id,
         p.display_name,
         p.base_currency,
         p.locale,
         p.created_at
       FROM account_sessions s
       JOIN accounts a ON a.id = s.account_id
       JOIN profiles p ON p.viewer_id = s.account_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .bind(tokenHash, Date.now())
    .first<SessionRow>();

  if (!row) return null;
  return {
    viewerId: row.account_id,
    email: row.email,
    profile: row,
  };
}

export async function deleteAccountSession(db: D1Database, token: string): Promise<void> {
  await db
    .prepare('DELETE FROM account_sessions WHERE token_hash = ?')
    .bind(await hashToken(token))
    .run();
}

export async function clearExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM account_sessions WHERE expires_at <= ?').bind(Date.now()).run();
}

export async function takeRateLimit(
  db: D1Database,
  identifier: string,
  options: { limit: number; windowMs: number; blockMs: number },
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const keyHash = await hashToken(identifier);
  const now = Date.now();
  const row = await db
    .prepare(
      `INSERT INTO auth_rate_limits
         (key_hash, attempts, window_started_at, blocked_until, updated_at)
       VALUES (?, 1, ?, 0, ?)
       ON CONFLICT(key_hash) DO UPDATE SET
         attempts = CASE
           WHEN auth_rate_limits.blocked_until > ? THEN auth_rate_limits.attempts
           WHEN ? - auth_rate_limits.window_started_at >= ? THEN 1
           ELSE auth_rate_limits.attempts + 1
         END,
         window_started_at = CASE
           WHEN auth_rate_limits.blocked_until > ? THEN auth_rate_limits.window_started_at
           WHEN ? - auth_rate_limits.window_started_at >= ? THEN ?
           ELSE auth_rate_limits.window_started_at
         END,
         blocked_until = CASE
           WHEN auth_rate_limits.blocked_until > ? THEN auth_rate_limits.blocked_until
           WHEN ? - auth_rate_limits.window_started_at >= ? THEN 0
           WHEN auth_rate_limits.attempts + 1 > ? THEN ? + ?
           ELSE 0
         END,
         updated_at = ?
       RETURNING attempts, window_started_at, blocked_until`,
    )
    .bind(
      keyHash,
      now,
      now,
      now,
      now,
      options.windowMs,
      now,
      now,
      options.windowMs,
      now,
      now,
      now,
      options.windowMs,
      options.limit,
      now,
      options.blockMs,
      now,
    )
    .first<RateLimitRow>();

  if (!row) throw new Error('The authentication rate limit could not be updated.');
  if (row.blocked_until > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((row.blocked_until - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function clearRateLimit(db: D1Database, identifier: string): Promise<void> {
  await db
    .prepare('DELETE FROM auth_rate_limits WHERE key_hash = ?')
    .bind(await hashToken(identifier))
    .run();
}

export async function clearStaleRateLimits(db: D1Database): Promise<void> {
  const now = Date.now();
  await db
    .prepare('DELETE FROM auth_rate_limits WHERE updated_at < ? AND blocked_until <= ?')
    .bind(now - RATE_LIMIT_RETENTION_MS, now)
    .run();
}
