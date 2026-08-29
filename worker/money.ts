const fractionDigitsByCurrency: Record<string, number> = {
  BHD: 3,
  JPY: 0,
  KRW: 0,
  KWD: 3,
};

const valueInInr: Record<string, number> = {
  INR: 1,
  USD: 83.4,
  EUR: 90.8,
  GBP: 106.2,
  JPY: 0.565,
  AUD: 55.4,
  CAD: 61.2,
  SGD: 62.1,
};

export function fractionDigits(currency: string): number {
  return fractionDigitsByCurrency[currency.toUpperCase()] ?? 2;
}

export function referenceRateMicros(from: string, to: string): number {
  const sourceCode = from.toUpperCase();
  const targetCode = to.toUpperCase();
  if (sourceCode === targetCode) return 1_000_000;

  const source = valueInInr[sourceCode];
  const target = valueInInr[targetCode];

  if (!source || !target) {
    throw new DomainError(`No reference rate is available for ${sourceCode}/${targetCode}.`);
  }

  return Math.round((source / target) * 1_000_000);
}

export function decimalRateToMicros(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new DomainError('Exchange rate must be a positive decimal with at most 6 places.');
  }

  const [whole, fraction = ''] = normalized.split('.');
  const micros = Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0'));
  if (!Number.isSafeInteger(micros) || micros <= 0) {
    throw new DomainError('Exchange rate is outside the supported range.');
  }

  return micros;
}

export function convertMinorUnits(
  amountMinor: number | bigint,
  fromCurrency: string,
  toCurrency: string,
  rateMicros: number,
): number {
  const sourceScale = 10n ** BigInt(fractionDigits(fromCurrency));
  const targetScale = 10n ** BigInt(fractionDigits(toCurrency));
  const numerator = BigInt(amountMinor) * BigInt(rateMicros) * targetScale;
  const denominator = sourceScale * 1_000_000n;
  const rounded = (numerator + denominator / 2n) / denominator;
  const result = Number(rounded);

  if (!Number.isSafeInteger(result)) {
    throw new DomainError('Converted amount is outside the supported range.');
  }

  return result;
}
import { DomainError } from './errors';
