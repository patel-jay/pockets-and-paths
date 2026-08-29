import { describe, expect, it } from 'vitest';
import { convertMinorUnits, decimalRateToMicros, referenceRateMicros } from './money';

describe('currency conversion', () => {
  it('converts between currencies with different fraction digits', () => {
    expect(convertMinorUnits(10_000, 'JPY', 'INR', 565_000)).toBe(565_000);
    expect(convertMinorUnits(10_000, 'INR', 'JPY', 1_769_912)).toBe(177);
  });

  it('rounds to the nearest target minor unit', () => {
    expect(convertMinorUnits(1, 'USD', 'INR', 83_400_000)).toBe(83);
  });

  it('parses explicit rates deterministically', () => {
    expect(decimalRateToMicros('1.234567')).toBe(1_234_567);
    expect(() => decimalRateToMicros('1.2345678')).toThrow(/at most 6/i);
  });

  it('rejects currencies without a saved demo rate', () => {
    expect(() => referenceRateMicros('CHF', 'INR')).toThrow(/no reference rate/i);
  });
});
