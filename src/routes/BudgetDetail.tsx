import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Shuffle } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Link, useParams } from 'react-router';
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState';
import { CategoryIcon } from '../components/CategoryIcon';
import { CategoryIconPicker } from '../components/CategoryIconPicker';
import { ExpenseList } from '../components/ExpenseList';
import { CategoryLimitModal } from '../components/CategoryLimitModal';
import { useAppActions } from '../lib/app-actions';
import {
  createCategoryMutation,
  graphqlRequest,
  splitCategoryLimitsMutation,
} from '../lib/graphql';
import { formatBudgetPeriod, formatMoney, parseMajorToMinor } from '../lib/money';
import { queryKeys, useBudget, useProfile } from '../lib/queries';
import type { Category } from '../types/app';
import type { CreateCategoryInput } from '../types/inputs';
import {
  defaultCategoryIcon,
  suggestCategoryIcon,
  type CategoryIconKey,
} from '../../shared/category-icons';

const defaultCategoryColor = '#2e7064';

export function BudgetDetailPage() {
  const { budgetId = '' } = useParams();
  const query = useBudget(budgetId);
  const profile = useProfile();
  const queryClient = useQueryClient();
  const { openExpense } = useAppActions();
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryColor, setCategoryColor] = useState(defaultCategoryColor);
  const [categoryIcon, setCategoryIcon] = useState<CategoryIconKey>(defaultCategoryIcon);
  const [iconSelectedManually, setIconSelectedManually] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formError, setFormError] = useState('');
  const mutation = useMutation({
    mutationFn: (input: CreateCategoryInput) => graphqlRequest(createCategoryMutation, { input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.budget(budgetId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.budgets });
      setCategoryColor(defaultCategoryColor);
      setCategoryIcon(defaultCategoryIcon);
      setIconSelectedManually(false);
      setShowCategoryForm(false);
    },
  });
  const splitMutation = useMutation({
    mutationFn: () => graphqlRequest(splitCategoryLimitsMutation, { budgetId }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.budget(budgetId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
    },
  });

  if (query.isLoading) return <LoadingState label="Loading budget…" />;
  if (query.isError)
    return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  const budget = query.data?.budget;
  if (!budget) return <ErrorState message="That budget does not exist or is unavailable." />;
  const locale = profile.data?.profile.locale ?? 'en-IN';

  const submitCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const form = new FormData(event.currentTarget);
    try {
      const limit = String(form.get('limit')).trim();
      mutation.mutate({
        budgetId,
        name: String(form.get('name')).trim(),
        limitMinor: limit ? parseMajorToMinor(limit, budget.currency) : null,
        color: String(form.get('color')),
        icon: categoryIcon,
      });
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Check the category details.');
    }
  };

  const toggleCategoryForm = () => {
    if (showCategoryForm) {
      setCategoryColor(defaultCategoryColor);
      setCategoryIcon(defaultCategoryIcon);
      setIconSelectedManually(false);
      setFormError('');
    }
    setShowCategoryForm(!showCategoryForm);
  };

  const splitEvenly = () => {
    if (!window.confirm('Replace all category limits with an even split of this budget?')) return;
    splitMutation.mutate();
  };

  return (
    <>
      <Link className="back-link" to="/budgets">
        <ArrowLeft size={16} />
        All budgets
      </Link>
      <header className="detail-header">
        <div>
          <p className="eyebrow">
            {budget.type === 'MONTHLY' ? 'Recurring monthly' : 'Fixed-date temporary'}
          </p>
          <h1>{budget.name}</h1>
          <p>
            {formatBudgetPeriod(budget.startDate, budget.endDate, budget.type, locale)} ·{' '}
            {budget.currency}
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => openExpense(budget.id)}>
          <Plus size={18} />
          Add expense
        </button>
      </header>

      <section className="detail-summary">
        <div>
          <span>Budget</span>
          <strong>{formatMoney(budget.amount.minor, budget.amount.currency, locale)}</strong>
        </div>
        <div>
          <span>Spent</span>
          <strong>{formatMoney(budget.spent.minor, budget.spent.currency, locale)}</strong>
        </div>
        <div className={budget.isOverBudget ? 'status-over' : ''}>
          <span>{budget.isOverBudget ? 'Over budget' : 'Remaining'}</span>
          <strong>
            {formatMoney(
              budget.isOverBudget ? budget.overspent.minor : budget.remaining.minor,
              budget.currency,
              locale,
            )}
          </strong>
        </div>
        <div>
          <span>Used</span>
          <strong className={budget.isOverBudget ? 'status-over' : ''}>
            {Math.round(budget.progress)}%
          </strong>
        </div>
      </section>

      <div className="detail-grid">
        <section className="panel-card" aria-labelledby="categories-title">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">Allocation</p>
              <h2 id="categories-title">Categories</h2>
            </div>
            <div className="category-actions">
              <button
                className="text-button"
                type="button"
                disabled={splitMutation.isPending}
                onClick={splitEvenly}
              >
                <Shuffle size={15} />
                {splitMutation.isPending ? 'Splitting…' : 'Split evenly'}
              </button>
              <button className="text-button" type="button" onClick={toggleCategoryForm}>
                <Plus size={16} />
                Add
              </button>
            </div>
          </div>
          {splitMutation.error && (
            <p className="panel-error" role="alert">
              {(splitMutation.error as Error).message}
            </p>
          )}
          {showCategoryForm && (
            <form className="inline-form" onSubmit={submitCategory}>
              <input
                name="name"
                required
                maxLength={40}
                placeholder="Category name"
                aria-label="Category name"
                onChange={(event) => {
                  if (!iconSelectedManually) {
                    setCategoryIcon(suggestCategoryIcon(event.target.value));
                  }
                }}
              />
              <input
                name="limit"
                inputMode="decimal"
                placeholder={`Optional limit in ${budget.currency}`}
                aria-label={`Optional limit in ${budget.currency}`}
              />
              <label className="color-picker">
                <input
                  type="color"
                  name="color"
                  value={categoryColor}
                  onChange={(event) => setCategoryColor(event.target.value)}
                  aria-label="Category color"
                />
                <span aria-hidden="true">{categoryColor.toUpperCase()}</span>
              </label>
              <button className="secondary-button" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Adding…' : 'Add'}
              </button>
              <CategoryIconPicker
                name="new-category-icon"
                value={categoryIcon}
                onChange={(icon) => {
                  setCategoryIcon(icon);
                  setIconSelectedManually(true);
                }}
              />
              {(formError || mutation.error) && (
                <p className="form-error">{formError || (mutation.error as Error).message}</p>
              )}
            </form>
          )}
          <div
            className={`allocation-summary${Number(budget.overallocated.minor) > 0 ? ' allocation-summary--over' : ''}`}
          >
            <span>
              <strong>
                {formatMoney(budget.allocated.minor, budget.allocated.currency, locale)}
              </strong>{' '}
              of {formatMoney(budget.amount.minor, budget.amount.currency, locale)} allocated to
              category limits
            </span>
            <small>
              {Number(budget.overallocated.minor) > 0
                ? `${formatMoney(budget.overallocated.minor, budget.overallocated.currency, locale)} overallocated`
                : `${formatMoney(budget.unallocated.minor, budget.unallocated.currency, locale)} unallocated`}
            </small>
          </div>
          <div className="category-layout">
            <div className="category-chart" aria-label="Category spending chart">
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={budget.categories}
                    dataKey={(item) => Number(item.spent.minor)}
                    nameKey="name"
                    innerRadius={58}
                    outerRadius={84}
                    paddingAngle={3}
                  >
                    {budget.categories.map((category) => (
                      <Cell key={category.id} fill={category.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatMoney(String(value), budget.currency, locale)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <span>
                <strong>{Math.round(budget.progress)}%</strong>
                <small>used</small>
              </span>
            </div>
            <div className="category-list">
              {budget.categories.map((category) => {
                const categoryOver = category.overspent && Number(category.overspent.minor) > 0;
                return (
                  <article key={category.id} className={categoryOver ? 'category-row--over' : ''}>
                    <span
                      className="category-symbol"
                      style={{
                        color: category.color,
                        backgroundColor: `${category.color}1f`,
                      }}
                    >
                      <CategoryIcon icon={category.icon} size={17} />
                    </span>
                    <div>
                      <strong>{category.name}</strong>
                      <small>
                        {formatMoney(category.spent.minor, category.spent.currency, locale)} spent
                        {category.limit &&
                          ` of ${formatMoney(category.limit.minor, category.limit.currency, locale)}`}
                      </small>
                      {category.hasLimit && category.progress !== null && (
                        <span
                          className={`category-meter${categoryOver ? ' category-meter--over' : ''}`}
                          aria-hidden="true"
                        >
                          <i style={{ width: `${Math.min(100, category.progress)}%` }} />
                        </span>
                      )}
                    </div>
                    <span className="category-status">
                      {!category.hasLimit && 'No category limit'}
                      {category.hasLimit &&
                        !categoryOver &&
                        category.remaining &&
                        `${formatMoney(category.remaining.minor, category.remaining.currency, locale)} left · ${Math.max(0, 100 - Math.round(category.progress ?? 0))}%`}
                      {categoryOver &&
                        category.overspent &&
                        `${formatMoney(category.overspent.minor, category.overspent.currency, locale)} over · ${Math.max(0, Math.round(category.progress ?? 100) - 100)}%`}
                    </span>
                    <button
                      className="category-edit"
                      type="button"
                      aria-label={`Edit ${category.name} category`}
                      onClick={() => setEditingCategory(category)}
                    >
                      <Pencil size={14} />
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <section className="activity-card" aria-labelledby="budget-expenses-title">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">Ledger</p>
            <h2 id="budget-expenses-title">Expenses</h2>
          </div>
        </div>
        {budget.expenses?.length ? (
          <ExpenseList expenses={budget.expenses} locale={locale} />
        ) : (
          <EmptyState
            title="No expenses in this budget"
            copy="Add the first one when you are ready."
          />
        )}
      </section>
      {editingCategory && (
        <CategoryLimitModal
          category={editingCategory}
          budgetId={budget.id}
          currency={budget.currency}
          open
          onClose={() => setEditingCategory(null)}
        />
      )}
    </>
  );
}
