import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  hashPassword,
  hashToken,
  secureStringEqual,
  verifyPassword,
} from './crypto';

describe('authentication cryptography', () => {
  it('verifies only the password and pepper used to create a hash', async () => {
    const hash = await hashPassword('a long personal password', 'development pepper');

    await expect(
      verifyPassword('a long personal password', hash, 'development pepper'),
    ).resolves.toBe(true);
    await expect(verifyPassword('a different password', hash, 'development pepper')).resolves.toBe(
      false,
    );
    await expect(
      verifyPassword('a long personal password', hash, 'different pepper'),
    ).resolves.toBe(false);
  });

  it('creates opaque session tokens and stable token hashes', async () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    await expect(hashToken(token)).resolves.toBe(await hashToken(token));
    await expect(secureStringEqual('invite', 'invite')).resolves.toBe(true);
    await expect(secureStringEqual('invite', 'other')).resolves.toBe(false);
  });
});
