import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { ExpenseList } from '../components/ExpenseList';
import { PageHeader } from '../components/PageHeader';
import { useExpenses, useProfile } from '../lib/queries';

export function ExpensesPage() {
  const expenses = useExpenses();
  const profile = useProfile();
  if (expenses.isLoading) return <LoadingState label="Loading expenses…" />;
  if (expenses.isError)
    return <ErrorState message={expenses.error.message} retry={() => expenses.refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow="One clear ledger"
        title="Expenses"
        copy="Everyday purchases and journey costs, kept in each budget’s currency."
        action="expense"
      />
      <section className="activity-card activity-card--page" aria-label="All expenses">
        {expenses.data?.expenses.length ? (
          <ExpenseList expenses={expenses.data.expenses} locale={profile.data?.profile.locale} />
        ) : (
          <EmptyState
            title="No expenses yet"
            copy="Add your first expense and it will appear here."
          />
        )}
      </section>
    </>
  );
}
