import { ArrowUpRight, Compass, Plus, Sparkles } from 'lucide-react';
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

  const { profile, balances, openBudgets, recentExpenses } = query.data.dashboard;
  const firstName = profile.displayName.split(' ')[0];
  const activeCount = openBudgets.filter((budget) => budget.phase === 'ACTIVE').length;
  const upcomingCount = openBudgets.filter((budget) => budget.phase === 'UPCOMING').length;
  const planStatusLabel = [
    activeCount > 0 && `${activeCount} active`,
    upcomingCount > 0 && `${upcomingCount} upcoming`,
  ]
    .filter(Boolean)
    .join(' · ');
  const phaseOrder = { ACTIVE: 0, UPCOMING: 1, ENDED: 2 } as const;
  const visibleBudgets = [...openBudgets]
    .sort(
      (left, right) =>
        phaseOrder[left.phase] - phaseOrder[right.phase] ||
        left.startDate.localeCompare(right.startDate),
    )
    .slice(0, 3);
  const showHeaderCreate = openBudgets.length >= 3;
  const dateLabel = new Intl.DateTimeFormat(profile.locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const currencyProgress = new Map<string, number>();
  const currencyTotals = new Map<string, { spent: bigint; total: bigint }>();

  openBudgets.forEach((budget) => {
    const current = currencyTotals.get(budget.currency) ?? { spent: 0n, total: 0n };
    currencyTotals.set(budget.currency, {
      spent: current.spent + BigInt(budget.spent.minor),
      total: current.total + BigInt(budget.amount.minor),
    });
  });

  currencyTotals.forEach(({ spent, total }, currency) => {
    const progress = total > 0n ? Number((spent * 1000n) / total) / 10 : 0;
    currencyProgress.set(currency, Math.min(100, progress));
  });

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
        <header className="summary-card__heading">
          <div>
            <p className="summary-card__eyebrow">Money available</p>
            <h2 id="summary-title">Remaining by currency</h2>
          </div>
          <span className="summary-card__badge">
            <Sparkles size={15} aria-hidden="true" />
            {planStatusLabel || 'No current plans'}
          </span>
        </header>
        <div className="summary-card__balances">
          {balances.map((balance, index) => {
            const progress = currencyProgress.get(balance.currency) ?? 0;

            return (
              <article
                className={`summary-card__balance summary-card__balance--${index % 4}`}
                key={balance.currency}
              >
                <div className="summary-card__balance-heading">
                  <span>{balance.currency}</span>
                  <small>
                    {balance.budgetCount} {balance.budgetCount === 1 ? 'plan' : 'plans'}
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
                <div
                  className="summary-card__progress"
                  role="progressbar"
                  aria-label={`${balance.currency} spending across active and upcoming plans`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
              </article>
            );
          })}
        </div>
        <p className="summary-card__note">
          Includes active and upcoming plans in their own currencies—no exchange-rate estimates.
        </p>
        <div className="summary-card__path" aria-hidden="true">
          <span />
          <Compass size={24} />
        </div>
      </section>

      <section className="section-block" aria-labelledby="budgets-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current and upcoming</p>
            <h2 id="budgets-title">Your plans</h2>
          </div>
          <div className="section-heading__actions">
            {showHeaderCreate && (
              <button
                className="new-budget-button"
                type="button"
                onClick={openBudget}
                aria-label="Create a budget"
              >
                <Plus size={16} /> <span>New budget</span>
              </button>
            )}
            <Link className="text-button" to="/budgets">
              View all <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
        <div className="budget-grid">
          {visibleBudgets.map((budget) => (
            <BudgetCard budget={budget} locale={profile.locale} key={budget.id} />
          ))}
          {!showHeaderCreate && (
            <button className="new-budget-card" type="button" onClick={openBudget}>
              <span>
                <Plus size={21} />
              </span>
              <strong>Create a budget</strong>
              <small>Monthly or fixed-date</small>
            </button>
          )}
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
