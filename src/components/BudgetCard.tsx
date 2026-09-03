import { ChevronRight, Home, Route } from 'lucide-react';
import { Link } from 'react-router';
import { formatBudgetPeriod, formatMoney, todayIso } from '../lib/money';
import type { Budget } from '../types/app';

const dayInMilliseconds = 86_400_000;

function toUtcDay(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(from: string, to: string): number {
  return Math.ceil((toUtcDay(to) - toUtcDay(from)) / dayInMilliseconds);
}

function budgetStatus(budget: Budget, progress: number): string {
  const today = todayIso();

  if (budget.status === 'ARCHIVED') return 'Archived';
  if (budget.phase === 'UPCOMING') {
    const days = Math.max(0, daysBetween(today, budget.startDate));
    return `Upcoming · ${days} ${days === 1 ? 'day' : 'days'} to go`;
  }
  if (budget.phase === 'ENDED') return 'Ended';
  if (budget.isOverBudget) return `Active · ${progress}% spent`;
  if (budget.type === 'MONTHLY') return `Active · ${Math.max(0, 100 - progress)}% left`;
  if (!budget.endDate) return 'Active · In progress';

  const days = Math.max(0, daysBetween(today, budget.endDate));
  return days === 0
    ? 'Active · Ends today'
    : `Active · ${days} ${days === 1 ? 'day' : 'days'} left`;
}

export function BudgetCard({ budget, locale = 'en-IN' }: { budget: Budget; locale?: string }) {
  const Icon = budget.type === 'MONTHLY' ? Home : Route;
  const tone = budget.type === 'MONTHLY' ? 'forest' : 'coral';
  const progress = Math.round(budget.progress);
  const status = budgetStatus(budget, progress);

  return (
    <article
      className={`budget-card budget-card--${tone}${budget.isOverBudget ? ' budget-card--over' : ''}${budget.status === 'ARCHIVED' ? ' budget-card--archived' : ''}`}
    >
      <div className="budget-card__topline">
        <span className="budget-card__icon">
          <Icon size={20} />
        </span>
        <span
          className={`budget-card__status${budget.isOverBudget && budget.status !== 'ARCHIVED' ? ' status-over' : ''}`}
        >
          {status}
        </span>
      </div>
      <h3>
        <Link to={`/budgets/${budget.id}`}>{budget.name}</Link>
      </h3>
      <p className="budget-card__meta">
        {formatBudgetPeriod(budget.startDate, budget.endDate, budget.type, locale)} ·{' '}
        {budget.currency}
      </p>
      <div className="budget-card__numbers">
        <div>
          <span>Spent</span>
          <strong>{formatMoney(budget.spent.minor, budget.spent.currency, locale)}</strong>
        </div>
        <div>
          <span>Total budget</span>
          <strong>{formatMoney(budget.amount.minor, budget.amount.currency, locale)}</strong>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, progress)}
        aria-valuetext={`${progress}% spent${budget.isOverBudget ? ', over budget' : ''}`}
        aria-label={`${budget.name} spending progress`}
        className={`progress-track${budget.isOverBudget ? ' progress-track--over' : ''}`}
      >
        <span style={{ width: `${Math.min(100, budget.progress)}%` }} />
      </div>
      <footer className="budget-card__footer">
        <p className={`budget-card__remaining${budget.isOverBudget ? ' status-over' : ''}`}>
          {budget.isOverBudget
            ? `${formatMoney(budget.overspent.minor, budget.overspent.currency, locale)} over`
            : `${formatMoney(budget.remaining.minor, budget.remaining.currency, locale)} remaining`}
        </p>
        <Link className="icon-link" to={`/budgets/${budget.id}`} aria-label={`Open ${budget.name}`}>
          <ChevronRight size={19} />
        </Link>
      </footer>
    </article>
  );
}
