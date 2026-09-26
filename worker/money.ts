export const supportedBudgetCurrencies = [
  'INR',
  'EUR',
  'USD',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'SGD',
] as const;

export function isSupportedBudgetCurrency(currency: string): boolean {
  return supportedBudgetCurrencies.includes(
    currency.toUpperCase() as (typeof supportedBudgetCurrencies)[number],
  );
}
