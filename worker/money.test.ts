import { describe, expect, it } from 'vitest';
import { isSupportedBudgetCurrency, supportedBudgetCurrencies } from './money';

describe('supported budget currencies', () => {
  it('accepts each currency exposed by the product', () => {
    expect(supportedBudgetCurrencies.every(isSupportedBudgetCurrency)).toBe(true);
  });

  it('rejects unsupported codes without depending on exchange-rate data', () => {
    expect(isSupportedBudgetCurrency('CHF')).toBe(false);
  });
});
