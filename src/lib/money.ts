const fractionDigits: Record<string, number> = {
  BHD: 3,
  JPY: 0,
  KRW: 0,
  KWD: 3,
};

export const supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD'];

export function currencyFractionDigits(currency: string): number {
  return fractionDigits[currency.toUpperCase()] ?? 2;
}

export function formatMoney(minor: string | number, currency: string, locale = 'en-IN'): string {
  const digits = currencyFractionDigits(currency);
  const value = Number(minor) / 10 ** digits;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: digits,
  }).format(value);
}

export function parseMajorToMinor(value: string, currency: string): string {
  const normalized = value.trim();
  const digits = currencyFractionDigits(currency);
  const pattern = digits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{0,${digits}})?$`);

  if (!pattern.test(normalized)) {
    throw new Error(`Enter a valid amount with up to ${digits} decimal places.`);
  }

  const [whole, fraction = ''] = normalized.split('.');
  const paddedFraction = fraction.padEnd(digits, '0');
  const minor = BigInt(whole) * 10n ** BigInt(digits) + BigInt(paddedFraction || '0');

  if (minor <= 0n || minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Enter an amount greater than zero and within the supported range.');
  }

  return minor.toString();
}

export function minorToMajorInput(minor: string, currency: string): string {
  const digits = currencyFractionDigits(currency);
  if (digits === 0) return minor;
  const padded = minor.padStart(digits + 1, '0');
  const whole = padded.slice(0, -digits);
  const fraction = padded.slice(-digits).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export function formatDate(date: string, locale = 'en-IN'): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatBudgetPeriod(
  startDate: string,
  endDate: string | null,
  type: 'MONTHLY' | 'TEMPORARY',
  locale = 'en-IN',
): string {
  if (type === 'MONTHLY') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${startDate}T00:00:00Z`));
  }

  return `${formatDate(startDate, locale)} – ${endDate ? formatDate(endDate, locale) : 'Open ended'}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
