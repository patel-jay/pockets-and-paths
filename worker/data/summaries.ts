import { convertMinorUnits } from '../money';
import type { BudgetRow } from '../types';

export function availableInProfileCurrency(budgets: BudgetRow[], profileCurrency: string): number {
  return budgets.reduce((total, budget) => {
    const remaining = Math.max(0, budget.amount_minor - (budget.spent_minor ?? 0));
    return (
      total +
      convertMinorUnits(
        remaining,
        budget.reporting_currency,
        profileCurrency,
        budget.profile_rate_micros,
      )
    );
  }, 0);
}

export function overspentInProfileCurrency(budgets: BudgetRow[], profileCurrency: string): number {
  return budgets.reduce((total, budget) => {
    const overspent = Math.max(0, (budget.spent_minor ?? 0) - budget.amount_minor);
    return (
      total +
      convertMinorUnits(
        overspent,
        budget.reporting_currency,
        profileCurrency,
        budget.profile_rate_micros,
      )
    );
  }, 0);
}
