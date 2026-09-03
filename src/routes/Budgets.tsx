import { Plus } from 'lucide-react';
import { BudgetCard } from '../components/BudgetCard';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { PageHeader } from '../components/PageHeader';
import { useAppActions } from '../lib/app-actions';
import { useArchivedBudgets, useBudgets, useProfile } from '../lib/queries';

export function BudgetsPage() {
  const budgets = useBudgets();
  const archivedBudgets = useArchivedBudgets();
  const profile = useProfile();
  const { openBudget } = useAppActions();
  if (budgets.isLoading || archivedBudgets.isLoading)
    return <LoadingState label="Loading budgets…" />;
  if (budgets.isError || archivedBudgets.isError) {
    const message =
      budgets.error?.message ?? archivedBudgets.error?.message ?? 'Budgets unavailable.';
    return (
      <ErrorState
        message={message}
        retry={() => void Promise.all([budgets.refetch(), archivedBudgets.refetch()])}
      />
    );
  }

  const archived = archivedBudgets.data?.archivedBudgets ?? [];

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
      {archived.length > 0 && (
        <section className="archived-budgets" aria-labelledby="archived-budgets-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Saved history</p>
              <h2 id="archived-budgets-title">Archived budgets</h2>
            </div>
            <span className="section-count">
              {archived.length} {archived.length === 1 ? 'budget' : 'budgets'}
            </span>
          </div>
          <div className="budget-grid budget-grid--page">
            {archived.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} locale={profile.data?.profile.locale} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
