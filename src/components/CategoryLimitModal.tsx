import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { graphqlRequest, updateCategoryLimitMutation } from '../lib/graphql';
import { minorToMajorInput, parseMajorToMinor } from '../lib/money';
import { queryKeys } from '../lib/queries';
import type { Category } from '../types/app';
import { Modal } from './Modal';

type Props = {
  category: Category;
  budgetId: string;
  currency: string;
  open: boolean;
  onClose: () => void;
};

export function CategoryLimitModal({ category, budgetId, currency, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: (limitMinor: string | null) =>
      graphqlRequest(updateCategoryLimitMutation, { categoryId: category.id, limitMinor }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.budget(budgetId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      onClose();
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const value = String(new FormData(event.currentTarget).get('limit')).trim();
    try {
      mutation.mutate(value ? parseMajorToMinor(value, currency) : null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Check the category limit.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${category.name} limit`}
      description="Set a planning limit, or leave it blank to track spending without a category percentage."
    >
      <form className="form-stack" onSubmit={submit}>
        <label className="form-field">
          <span>
            Limit in {currency} <small>Optional</small>
          </span>
          <input
            name="limit"
            inputMode="decimal"
            autoFocus
            defaultValue={category.limit ? minorToMajorInput(category.limit.minor, currency) : ''}
            placeholder="No category limit"
          />
        </label>
        {(error || mutation.error) && (
          <p className="form-error" role="alert">
            {error || (mutation.error as Error).message}
          </p>
        )}
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : category.hasLimit ? 'Update limit' : 'Set limit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
