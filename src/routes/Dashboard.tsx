import { ArrowUpRight, Compass, Plus } from 'lucide-react';
import { Link } from 'react-router';
import { BudgetCard } from '../components/BudgetCard';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { ExpenseList } from '../components/ExpenseList';
import { useAppActions } from '../lib/app-actions';
import { formatMoney } from '../lib/money';
import { useDashboard } from '../lib/queries';

export function Dashboard() {
  const query = useDashboard();
  const { openBudget, openExpense } = useAppActions();

  if (query.isLoading) return <LoadingState />;
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  if (!query.data) return null;

  const { profile, balances, activeBudgets, recentExpenses } = query.data.dashboard;
  const firstName = profile.displayName.split(' ')[0];
  const dateLabel = new Intl.DateTimeFormat(profile.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">{dateLabel}</p>
          <h1>Welcome back, {firstName}.</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => openExpense()}>
          <Plus size={18} />
          Add expense
        </button>
      </header>

      <section className="summary-card" aria-labelledby="summary-title">
        <div>
          <p className="summary-card__label" id="summary-title">
            Remaining by currency
          </p>
          <div className="summary-card__balances">
            {balances.map((balance) => (
              <article key={balance.currency}>
                <div className="summary-card__balance-heading">
                  <span>{balance.currency}</span>
                  <small>
                    {balance.budgetCount} active {balance.budgetCount === 1 ? 'budget' : 'budgets'}
                  </small>
                </div>
                <strong>
                  {formatMoney(balance.remaining.minor, balance.currency, profile.locale)}
                </strong>
                {Number(balance.overspent.minor) > 0 && (
                  <small className="summary-card__overage">
                    {formatMoney(balance.overspent.minor, balance.currency, profile.locale)} over
                  </small>
                )}
              </article>
            ))}
          </div>
          <p className="summary-card__note">
            Balances stay in their budget currencies—no exchange-rate estimates.
          </p>
        </div>
        <div className="summary-card__path" aria-hidden="true">
          <span />
          <Compass size={24} />
        </div>
      </section>

      <section className="section-block" aria-labelledby="budgets-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">At a glance</p>
            <h2 id="budgets-title">Your active budgets</h2>
          </div>
          <Link className="text-button" to="/budgets">
            View all <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="budget-grid">
          {activeBudgets.slice(0, 2).map((budget) => (
            <BudgetCard budget={budget} locale={profile.locale} key={budget.id} />
          ))}
          <button className="new-budget-card" type="button" onClick={openBudget}>
            <span>
              <Plus size={21} />
            </span>
            <strong>Create another budget</strong>
            <small>Monthly or fixed-date</small>
          </button>
        </div>
      </section>

      <section className="activity-card" aria-labelledby="activity-title">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">Latest activity</p>
            <h2 id="activity-title">Recent expenses</h2>
          </div>
          <Link className="text-button" to="/expenses">
            All expenses <ArrowUpRight size={16} />
          </Link>
        </div>
        {recentExpenses.length ? (
          <ExpenseList expenses={recentExpenses} locale={profile.locale} />
        ) : (
          <EmptyState title="No expenses yet" copy="Add your first expense to see activity here." />
        )}
      </section>
    </>
  );
}
