import type { BudgetRow, CurrencyBalance } from '../types';

export function summarizeBalancesByCurrency(budgets: BudgetRow[]): CurrencyBalance[] {
  const balances = new Map<string, CurrencyBalance>();

  for (const budget of budgets) {
    const spent = budget.spent_minor ?? 0;
    const current = balances.get(budget.reporting_currency) ?? {
      currency: budget.reporting_currency,
      remainingMinor: 0,
      overspentMinor: 0,
      budgetCount: 0,
    };
    current.remainingMinor += Math.max(0, budget.amount_minor - spent);
    current.overspentMinor += Math.max(0, spent - budget.amount_minor);
    current.budgetCount += 1;
    balances.set(current.currency, current);
  }

  return [...balances.values()].sort((left, right) => left.currency.localeCompare(right.currency));
}
