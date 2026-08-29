import { referenceRateMicros } from '../money';
import { DomainError } from '../errors';

export function requireText(value: string, label: string, maxLength: number): string {
  const normalized = value.trim();
  if (!normalized) throw new DomainError(`${label} is required.`);
  if (normalized.length > maxLength) throw new DomainError(`${label} is too long.`);
  return normalized;
}

export function optionalText(
  value: string | null | undefined,
  label: string,
  maxLength: number,
): string | null {
  const normalized = value?.trim() ?? '';
  if (!normalized) return null;
  if (normalized.length > maxLength) throw new DomainError(`${label} is too long.`);
  return normalized;
}

export function requireIsoDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError(`${label} must be a valid date.`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new DomainError(`${label} must be a valid date.`);
  }
  return value;
}

export function requirePositiveMinor(value: string, label: string): number {
  const amount = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new DomainError(`${label} must be a positive amount.`);
  }
  return amount;
}

export function optionalPositiveMinor(
  value: string | null | undefined,
  label: string,
): number | null {
  return value ? requirePositiveMinor(value, label) : null;
}

export function requireCurrency(value: string): string {
  const currency = value.toUpperCase();
  referenceRateMicros(currency, 'INR');
  return currency;
}

export function requireColor(value: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new DomainError('Choose a valid category color.');
  return value.toLowerCase();
}

export function requireLocale(value: string): string {
  if (!/^en-(IN|GB|US)$|^de-DE$/.test(value)) {
    throw new DomainError('Choose a supported locale.');
  }
  return value;
}
