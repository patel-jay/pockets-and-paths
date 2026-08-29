import { describe, expect, it } from 'vitest';
import { buildSeedTimeline } from './seed';

describe('buildSeedTimeline', () => {
  it('anchors the monthly plan to the current month', () => {
    const timeline = buildSeedTimeline(new Date('2031-01-18T12:00:00Z'));

    expect(timeline.monthlyName).toBe('January monthly');
    expect(timeline.monthlyStart).toBe('2031-01-01');
    expect(timeline.monthlyExpenseDates).toEqual([
      '2031-01-17',
      '2031-01-02',
      '2031-01-15',
      '2031-01-13',
    ]);
  });

  it('rolls the temporary journey into a future year when needed', () => {
    const timeline = buildSeedTimeline(new Date('2031-11-05T12:00:00Z'));

    expect(timeline.tripStart).toBe('2032-01-12');
    expect(timeline.tripEnd).toBe('2032-01-24');
    expect(timeline.bookingDates.every((date) => date.startsWith('2031-11'))).toBe(true);
  });
});
