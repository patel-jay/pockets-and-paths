import type { ProfileRow, UpdateProfileInput } from '../types';
import { seedViewer } from './seed';
import { requireCurrency, requireLocale, requireText } from './validation';

export async function ensureViewer(db: D1Database, viewerId: string): Promise<void> {
  if (await viewerExists(db, viewerId)) return;
  await seedViewer(db, viewerId);
}

export async function getProfile(db: D1Database, viewerId: string): Promise<ProfileRow> {
  const profile = await db
    .prepare('SELECT * FROM profiles WHERE viewer_id = ?')
    .bind(viewerId)
    .first<ProfileRow>();

  if (!profile) throw new Error('Profile was not found.');
  return profile;
}

export async function viewerExists(db: D1Database, viewerId: string): Promise<boolean> {
  const profile = await db
    .prepare('SELECT viewer_id FROM profiles WHERE viewer_id = ?')
    .bind(viewerId)
    .first<{ viewer_id: string }>();
  return Boolean(profile);
}

export async function resetViewer(db: D1Database, viewerId: string): Promise<void> {
  await db.prepare('DELETE FROM profiles WHERE viewer_id = ?').bind(viewerId).run();
  await seedViewer(db, viewerId);
}

export async function updateProfile(
  db: D1Database,
  viewerId: string,
  input: UpdateProfileInput,
): Promise<ProfileRow> {
  const currency = requireCurrency(input.defaultCurrency);
  const displayName = requireText(input.displayName, 'Display name', 60);
  const locale = requireLocale(input.locale);

  await db
    .prepare(
      `UPDATE profiles SET display_name = ?, base_currency = ?, locale = ?
       WHERE viewer_id = ?`,
    )
    .bind(displayName, currency, locale, viewerId)
    .run();

  return getProfile(db, viewerId);
}
