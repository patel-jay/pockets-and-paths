import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { addExpenseMutation, graphqlRequest, previewExpenseMutation } from '../lib/graphql';
import { formatMoney, parseMajorToMinor, todayIso } from '../lib/money';
import { useBudgets } from '../lib/queries';
import type { ExpenseImpact } from '../types/app';
import type { AddExpenseInput, ExpenseImpactInput } from '../types/inputs';
import { ErrorState, LoadingState } from './AsyncState';
import { Modal } from './Modal';

type Props = { open: boolean; onClose: () => void; preferredBudgetId?: string };

export function AddExpenseModal({ open, onClose, preferredBudgetId }: Props) {
  const queryClient = useQueryClient();
  const budgetsQuery = useBudgets();
  const budgets = useMemo(() => budgetsQuery.data?.budgets ?? [], [budgetsQuery.data]);
  const [budgetId, setBudgetId] = useState(preferredBudgetId ?? '');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState<{ fingerprint: string; impact: ExpenseImpact } | null>(
    null,
  );
  const selectedBudget = budgets.find((budget) => budget.id === budgetId) ?? budgets[0];
  const selectedBudgetId = selectedBudget?.id ?? '';
  const selectedCurrency = selectedBudget?.currency || 'INR';

  const mutation = useMutation({
    mutationFn: (input: AddExpenseInput) => graphqlRequest(addExpenseMutation, { input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onClose();
    },
  });
  const previewMutation = useMutation({
    mutationFn: (input: ExpenseImpactInput) => graphqlRequest(previewExpenseMutation, { input }),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const input = {
        budgetId: selectedBudgetId,
        categoryId: String(form.get('categoryId')),
        title: String(form.get('title')).trim(),
        amountMinor: parseMajorToMinor(String(form.get('amount')), selectedCurrency),
        expenseDate: String(form.get('expenseDate')),
        notes: String(form.get('notes') || '').trim() || null,
      };
      const fingerprint = JSON.stringify(input);
      if (warning?.fingerprint === fingerprint) {
        mutation.mutate(input);
        return;
      }

      previewMutation.mutate(
        {
          budgetId: input.budgetId,
          categoryId: input.categoryId,
          amountMinor: input.amountMinor,
        },
        {
          onSuccess: ({ previewExpense }) => {
            if (previewExpense.budgetWillOverspend || previewExpense.categoryWillOverspend) {
              setWarning({ fingerprint, impact: previewExpense });
            } else {
              mutation.mutate(input);
            }
          },
          onError: (caught) => {
            setError(
              caught instanceof Error ? caught.message : 'The expense could not be checked.',
            );
          },
        },
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Check the expense details.');
    }
  };

  const mutationError = mutation.error instanceof Error ? mutation.error.message : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an expense"
      description="Every expense uses the selected budget’s currency."
    >
      {budgetsQuery.isLoading && <LoadingState label="Loading budgets…" />}
      {budgetsQuery.isError && (
        <ErrorState message={budgetsQuery.error.message} retry={() => budgetsQuery.refetch()} />
      )}
      {budgets.length > 0 && (
        <form className="form-stack" onSubmit={submit}>
          <label className="form-field">
            <span>Budget</span>
            <select
              name="budgetId"
              value={selectedBudgetId}
              onChange={(event) => {
                setBudgetId(event.target.value);
              }}
            >
              {budgets.map((budget) => (
                <option value={budget.id} key={budget.id}>
                  {budget.name} · {budget.currency}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label className="form-field form-field--grow">
              <span>Description</span>
              <input name="title" required maxLength={80} placeholder="Train tickets" />
            </label>
            <label className="form-field">
              <span>Category</span>
              <select name="categoryId" required>
                {selectedBudget?.categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-field">
            <span>Amount in {selectedCurrency}</span>
            <input
              name="amount"
              required
              inputMode="decimal"
              placeholder={selectedCurrency === 'JPY' ? '28400' : '42.50'}
            />
            <small>The currency is set by {selectedBudget?.name}.</small>
          </label>

          <label className="form-field">
            <span>Date</span>
            <span className="input-with-icon">
              <CalendarDays size={17} />
              <input name="expenseDate" type="date" required defaultValue={todayIso()} />
            </span>
          </label>
          <label className="form-field">
            <span>
              Notes <small>Optional</small>
            </span>
            <textarea
              name="notes"
              maxLength={300}
              rows={3}
              placeholder="Booking reference, who joined, or anything useful later"
            />
          </label>

          {warning && (
            <div className="overspend-warning" role="alert">
              <strong>This expense goes beyond the current plan.</strong>
              {warning.impact.categoryWillOverspend && warning.impact.categoryOverspent && (
                <p>
                  {warning.impact.categoryName} will be{' '}
                  {formatMoney(
                    warning.impact.categoryOverspent.minor,
                    warning.impact.categoryOverspent.currency,
                  )}{' '}
                  over its category limit.
                </p>
              )}
              {warning.impact.budgetWillOverspend && (
                <p>
                  The budget will be{' '}
                  {formatMoney(
                    warning.impact.budgetOverspent.minor,
                    warning.impact.budgetOverspent.currency,
                  )}{' '}
                  over overall.
                </p>
              )}
              <small>
                You can still record it—budgets guide spending rather than block reality.
              </small>
            </div>
          )}

          {(error || mutationError || previewMutation.error) && (
            <p className="form-error" role="alert">
              {error || mutationError || (previewMutation.error as Error).message}
            </p>
          )}
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={mutation.isPending || previewMutation.isPending || !selectedBudget}
            >
              {mutation.isPending
                ? 'Saving…'
                : previewMutation.isPending
                  ? 'Checking…'
                  : warning
                    ? 'Add anyway'
                    : 'Save expense'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
