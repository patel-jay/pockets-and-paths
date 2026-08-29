import { describe, expect, it } from 'vitest';
import { formatBudgetPeriod, minorToMajorInput, parseMajorToMinor } from './money';

describe('parseMajorToMinor', () => {
  it('converts decimal currencies without floating point arithmetic', () => {
    expect(parseMajorToMinor('1200.05', 'EUR')).toBe('120005');
  });

  it('supports zero-decimal currencies', () => {
    expect(parseMajorToMinor('28400', 'JPY')).toBe('28400');
    expect(() => parseMajorToMinor('28.4', 'JPY')).toThrow(/valid amount/i);
  });

  it('rejects zero and too many decimal places', () => {
    expect(() => parseMajorToMinor('0', 'INR')).toThrow(/greater than zero/i);
    expect(() => parseMajorToMinor('2.999', 'USD')).toThrow(/valid amount/i);
  });
});

describe('formatBudgetPeriod', () => {
  it('describes monthly and temporary periods differently', () => {
    expect(formatBudgetPeriod('2026-08-01', null, 'MONTHLY', 'en-GB')).toBe('August 2026');
    expect(formatBudgetPeriod('2026-10-12', '2026-10-24', 'TEMPORARY', 'en-GB')).toContain(
      '12 Oct 2026',
    );
  });
});

describe('minorToMajorInput', () => {
  it('restores an editable major-unit value without losing precision', () => {
    expect(minorToMajorInput('120005', 'EUR')).toBe('1200.05');
    expect(minorToMajorInput('28400', 'JPY')).toBe('28400');
  });
});
