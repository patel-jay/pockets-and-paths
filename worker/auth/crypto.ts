const PASSWORD_SCHEME = 'pbkdf2-sha256';
const PASSWORD_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

const encoder = new TextEncoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
      key,
      HASH_BYTES * 8,
    ),
  );
}

async function pepperPassword(derived: Uint8Array, pepper: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, derived as BufferSource));
}

export async function hashPassword(password: string, pepper: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  const hash = await pepperPassword(derived, pepper);
  return [
    PASSWORD_SCHEME,
    String(PASSWORD_ITERATIONS),
    encodeBase64Url(salt),
    encodeBase64Url(hash),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  pepper: string,
): Promise<boolean> {
  const [scheme, iterationsText, saltText, expectedText, extra] = storedHash.split('$');
  const iterations = Number(iterationsText);
  if (
    extra !== undefined ||
    scheme !== PASSWORD_SCHEME ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    iterations > 2_000_000 ||
    !saltText ||
    !expectedText
  ) {
    return false;
  }

  try {
    const salt = decodeBase64Url(saltText);
    const expected = decodeBase64Url(expectedText);
    if (salt.length !== SALT_BYTES || expected.length !== HASH_BYTES) return false;
    const derived = await derivePassword(password, salt, iterations);
    const actual = await pepperPassword(derived, pepper);
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createSessionToken(): string {
  return encodeBase64Url(randomBytes(32));
}

export async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function secureStringEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([hashToken(left), hashToken(right)]);
  return constantTimeEqual(encoder.encode(leftHash), encoder.encode(rightHash));
}

export const passwordPolicy = {
  minLength: 12,
  maxLength: 128,
} as const;
