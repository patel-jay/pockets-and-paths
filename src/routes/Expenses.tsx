import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { AddExpenseModal } from '../components/AddExpenseModal';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { ExpenseList } from '../components/ExpenseList';
import { PageHeader } from '../components/PageHeader';
import { useArchivedBudgets, useBudgets, useExpensePage, useProfile } from '../lib/queries';
import type { Expense } from '../types/app';

export function ExpensesPage() {
  const budgets = useBudgets();
  const archivedBudgets = useArchivedBudgets();
  const profile = useProfile();
  const [budgetId, setBudgetId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const filter = useMemo(
    () => ({
      budgetId: budgetId || null,
      categoryId: categoryId || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      search: search.trim() || null,
    }),
    [budgetId, categoryId, dateFrom, dateTo, search],
  );
  const expenses = useExpensePage(filter);
  const items = expenses.data?.pages.flatMap((page) => page.expensePage.items) ?? [];
  const allBudgets = [
    ...(budgets.data?.budgets ?? []),
    ...(archivedBudgets.data?.archivedBudgets ?? []),
  ];
  const selectedBudget = allBudgets.find((budget) => budget.id === budgetId);

  if (expenses.isLoading || budgets.isLoading || archivedBudgets.isLoading)
    return <LoadingState label="Loading expenses…" />;
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
      <section className="ledger-filters" aria-label="Expense filters">
        <div className="ledger-filters__heading">
          <Filter size={17} />
          <strong>Filter expenses</strong>
        </div>
        <label className="form-field">
          <span>Search</span>
          <input
            value={search}
            maxLength={80}
            placeholder="Description or notes"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>Budget</span>
          <select
            value={budgetId}
            onChange={(event) => {
              setBudgetId(event.target.value);
              setCategoryId('');
            }}
          >
            <option value="">All budgets</option>
            {allBudgets.map((budget) => (
              <option key={budget.id} value={budget.id}>
                {budget.name}
                {budget.status === 'ARCHIVED' ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Category</span>
          <select
            value={categoryId}
            disabled={!selectedBudget}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">All categories</option>
            {selectedBudget?.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>To</span>
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setBudgetId('');
            setCategoryId('');
            setDateFrom('');
            setDateTo('');
            setSearch('');
          }}
        >
          Clear filters
        </button>
      </section>
      <section className="activity-card activity-card--page" aria-label="All expenses">
        {items.length ? (
          <>
            <ExpenseList
              expenses={items}
              locale={profile.data?.profile.locale}
              editable
              onEdit={setEditingExpense}
            />
            {expenses.hasNextPage && (
              <div className="ledger-load-more">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={expenses.isFetchingNextPage}
                  onClick={() => void expenses.fetchNextPage()}
                >
                  {expenses.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState
            title="No expenses yet"
            copy="Add your first expense and it will appear here."
          />
        )}
      </section>
      {editingExpense && (
        <AddExpenseModal open expense={editingExpense} onClose={() => setEditingExpense(null)} />
      )}
    </>
  );
}
