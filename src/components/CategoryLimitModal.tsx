import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { graphqlRequest, updateCategoryMutation } from '../lib/graphql';
import { minorToMajorInput, parseMajorToMinor } from '../lib/money';
import { queryKeys } from '../lib/queries';
import type { Category } from '../types/app';
import type { UpdateCategoryInput } from '../types/inputs';
import { CategoryIconPicker } from './CategoryIconPicker';
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
  const [color, setColor] = useState(category.color);
  const [icon, setIcon] = useState(category.icon);
  const mutation = useMutation({
    mutationFn: (input: UpdateCategoryInput) => graphqlRequest(updateCategoryMutation, { input }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.budget(budgetId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
        queryClient.invalidateQueries({ queryKey: queryKeys.expenses }),
      ]);
      onClose();
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const value = String(new FormData(event.currentTarget).get('limit')).trim();
    try {
      mutation.mutate({
        categoryId: category.id,
        limitMinor: value ? parseMajorToMinor(value, currency) : null,
        color,
        icon,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Check the category limit.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${category.name}`}
      description="Choose how this category looks and optionally set a planning limit."
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
        <div className="category-appearance-fields">
          <div className="form-field">
            <span>Color</span>
            <label className="color-picker">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                aria-label="Category color"
              />
              <span aria-hidden="true">{color.toUpperCase()}</span>
            </label>
          </div>
          <CategoryIconPicker name="edit-category-icon" value={icon} onChange={setIcon} />
        </div>
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
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
