import { useOutletContext } from 'react-router';

export type AppOutletContext = {
  openExpense: (budgetId?: string) => void;
  openBudget: () => void;
};

export function useAppActions() {
  return useOutletContext<AppOutletContext>();
}
