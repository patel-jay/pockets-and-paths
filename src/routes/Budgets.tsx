import { Plus } from 'lucide-react';
import { BudgetCard } from '../components/BudgetCard';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PageHeader } from '../components/PageHeader';
import { useAppActions } from '../lib/app-actions';
import { useBudgets, useProfile } from '../lib/queries';

export function BudgetsPage() {
  const budgets = useBudgets();
  const profile = useProfile();
  const { openBudget } = useAppActions();
  if (budgets.isLoading) return <LoadingState label="Loading budgets…" />;
  if (budgets.isError)
    return <ErrorState message={budgets.error.message} retry={() => budgets.refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow="Plans for every pace"
        title="Budgets"
        copy="Keep daily life moving while you save and spend for temporary journeys."
        action="budget"
      />
      {budgets.data?.budgets.length ? (
        <div className="budget-grid budget-grid--page">
          {budgets.data.budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} locale={profile.data?.profile.locale} />
          ))}
          <button className="new-budget-card" type="button" onClick={openBudget}>
            <span>
              <Plus size={21} />
            </span>
            <strong>Create another budget</strong>
            <small>Monthly or fixed-date</small>
          </button>
        </div>
      ) : (
        <EmptyState
          title="No open budgets"
          copy="Create a monthly plan or a fixed-date journey budget to begin."
        />
      )}
    </>
  );
}
