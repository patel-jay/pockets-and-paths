export type BudgetPhase = 'ACTIVE' | 'UPCOMING' | 'ENDED';

type BudgetSchedule = {
  type: 'MONTHLY' | 'TEMPORARY';
  startDate: string;
  endDate: string | null;
};

export function utcTodayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getBudgetPhase(schedule: BudgetSchedule, today: string): BudgetPhase {
  if (schedule.startDate > today) return 'UPCOMING';
  if (schedule.type === 'TEMPORARY' && schedule.endDate && schedule.endDate < today) {
    return 'ENDED';
  }
  return 'ACTIVE';
}
