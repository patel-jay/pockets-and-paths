import { ChevronRight, Home, Route } from 'lucide-react';
import { Link } from 'react-router';
import { formatBudgetPeriod, formatMoney } from '../lib/money';
import type { Budget } from '../types/app';

export function BudgetCard({ budget, locale = 'en-IN' }: { budget: Budget; locale?: string }) {
  const Icon = budget.type === 'MONTHLY' ? Home : Route;
  const tone = budget.type === 'MONTHLY' ? 'forest' : 'coral';
  const progress = Math.round(budget.progress);

  return (
    <article
      className={`budget-card budget-card--${tone}${budget.isOverBudget ? ' budget-card--over' : ''}`}
    >
      <div className="budget-card__topline">
        <span className="budget-card__icon">
          <Icon size={20} />
        </span>
        <Link className="icon-link" to={`/budgets/${budget.id}`} aria-label={`Open ${budget.name}`}>
          <ChevronRight size={19} />
        </Link>
      </div>
      <h3>
        <Link to={`/budgets/${budget.id}`}>{budget.name}</Link>
      </h3>
      <p className="budget-card__meta">
        {formatBudgetPeriod(budget.startDate, budget.endDate, budget.type, locale)} ·{' '}
        {budget.reportingCurrency}
      </p>
      <div className="budget-card__numbers">
        <span>
          <strong>{formatMoney(budget.spent.minor, budget.spent.currency, locale)}</strong> spent
        </span>
        <small>of {formatMoney(budget.amount.minor, budget.amount.currency, locale)}</small>
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
      <p className={`budget-card__remaining${budget.isOverBudget ? ' status-over' : ''}`}>
        {budget.isOverBudget
          ? `${formatMoney(budget.overspent.minor, budget.overspent.currency, locale)} over · ${progress}% spent`
          : `${formatMoney(budget.remaining.minor, budget.remaining.currency, locale)} left · ${Math.max(0, 100 - progress)}% remaining`}
      </p>
    </article>
  );
}
