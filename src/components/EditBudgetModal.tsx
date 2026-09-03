import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router';
import {
  archiveBudgetMutation,
  graphqlRequest,
  restoreBudgetMutation,
  updateBudgetMutation,
} from '../lib/graphql';
import { minorToMajorInput, parseMajorToMinor } from '../lib/money';
import { queryKeys } from '../lib/queries';
import type { Budget } from '../types/app';
import type { UpdateBudgetInput } from '../types/inputs';
import { Modal } from './Modal';

type Props = {
  budget: Budget;
  open: boolean;
  onClose: () => void;
};

type StatusAction = 'archive' | 'restore';

export function EditBudgetModal({ budget, open, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const updateMutation = useMutation({
    mutationFn: (input: UpdateBudgetInput) => graphqlRequest(updateBudgetMutation, { input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onClose();
    },
  });
  const statusMutation = useMutation({
    mutationFn: async (action: StatusAction) => {
      if (action === 'archive') {
        await graphqlRequest(archiveBudgetMutation, { id: budget.id });
        return;
      }
      await graphqlRequest(restoreBudgetMutation, { id: budget.id });
    },
    onSuccess: async (_result, action) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.budget(budget.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses }),
      ]);
      onClose();
      if (action === 'archive') navigate('/budgets');
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const startDate = String(form.get('startDate'));
      const endDate = budget.type === 'TEMPORARY' ? String(form.get('endDate')) : null;
      if (endDate && endDate < startDate) {
        throw new Error('End date must be on or after the start date.');
      }
      updateMutation.mutate({
        budgetId: budget.id,
        name: String(form.get('name')).trim(),
        amountMinor: parseMajorToMinor(String(form.get('amount')), budget.currency),
        startDate,
        endDate,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Check the budget details.');
    }
  };

  const mutationError =
    (updateMutation.error instanceof Error && updateMutation.error.message) ||
    (statusMutation.error instanceof Error && statusMutation.error.message) ||
    '';
  const isArchived = budget.status === 'ARCHIVED';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit budget"
      description={
        isArchived
          ? 'Restore this budget before changing its details.'
          : 'Update the plan details without changing its currency or type.'
      }
    >
      <form className="form-stack" onSubmit={submit}>
        <div className="budget-fixed-details" aria-label="Fixed budget details">
          <div>
            <span>Budget type</span>
            <strong>{budget.type === 'MONTHLY' ? 'Monthly' : 'Temporary'}</strong>
          </div>
          <div>
            <span>Currency</span>
            <strong>{budget.currency}</strong>
          </div>
        </div>
        <small className="form-note">
          Type and currency stay fixed so existing categories and expenses remain consistent.
        </small>

        <fieldset className="form-fieldset" disabled={isArchived}>
          <label className="form-field">
            <span>Budget name</span>
            <input name="name" required maxLength={60} defaultValue={budget.name} />
          </label>

          <label className="form-field">
            <span>Total budget in {budget.currency}</span>
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={minorToMajorInput(budget.amount.minor, budget.currency)}
            />
          </label>

          <div className="form-row">
            <label className="form-field form-field--grow">
              <span>{budget.type === 'MONTHLY' ? 'Month starts' : 'Start date'}</span>
              <span className="input-with-icon">
                <CalendarDays size={17} />
                <input name="startDate" type="date" required defaultValue={budget.startDate} />
              </span>
            </label>
            {budget.type === 'TEMPORARY' && (
              <label className="form-field form-field--grow">
                <span>End date</span>
                <span className="input-with-icon">
                  <CalendarDays size={17} />
                  <input name="endDate" type="date" required defaultValue={budget.endDate ?? ''} />
                </span>
              </label>
            )}
          </div>
        </fieldset>

        {(error || mutationError) && (
          <p className="form-error" role="alert">
            {error || mutationError}
          </p>
        )}

        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          {!isArchived && (
            <button className="primary-button" type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </form>

      <section className={`budget-lifecycle${isArchived ? ' budget-lifecycle--archived' : ''}`}>
        {isArchived ? (
          <>
            <div>
              <strong>Archived budget</strong>
              <p>Restore it to edit the plan or add new expenses.</p>
            </div>
            <button
              className="secondary-button"
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate('restore')}
            >
              <ArchiveRestore size={17} />
              {statusMutation.isPending ? 'Restoring…' : 'Restore budget'}
            </button>
          </>
        ) : confirmArchive ? (
          <div className="archive-confirmation">
            <div>
              <strong>Archive this budget?</strong>
              <p>
                It will become read-only and move to Archived budgets. You can restore it later.
              </p>
            </div>
            <div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setConfirmArchive(false)}
              >
                Keep budget
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate('archive')}
              >
                {statusMutation.isPending ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <strong>Finished with this budget?</strong>
              <p>Archive it to keep the history without showing it in your current plans.</p>
            </div>
            <button className="danger-button" type="button" onClick={() => setConfirmArchive(true)}>
              <Archive size={17} />
              Archive budget
            </button>
          </>
        )}
      </section>
    </Modal>
  );
}
