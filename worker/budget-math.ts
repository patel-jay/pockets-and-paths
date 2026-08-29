export type SpendingPosition = {
  progress: number;
  remaining: number;
  overspent: number;
  isOver: boolean;
};

export function spendingPosition(spent: number, limit: number): SpendingPosition {
  if (!Number.isSafeInteger(spent) || spent < 0) throw new Error('Spent amount is invalid.');
  if (!Number.isSafeInteger(limit) || limit <= 0) throw new Error('Limit must be positive.');

  const overspent = Math.max(0, spent - limit);
  return {
    progress: (spent / limit) * 100,
    remaining: Math.max(0, limit - spent),
    overspent,
    isOver: overspent > 0,
  };
}

export function optionalSpendingPosition(
  spent: number,
  limit: number | null,
): SpendingPosition | null {
  return limit === null ? null : spendingPosition(spent, limit);
}
