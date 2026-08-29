import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CircleDollarSign, Route } from 'lucide-react';
import { createBudgetMutation, graphqlRequest } from '../lib/graphql';
import { parseMajorToMinor, supportedCurrencies, todayIso } from '../lib/money';
import { Modal } from './Modal';

type Props = { open: boolean; onClose: () => void };

export function CreateBudgetModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'MONTHLY' | 'TEMPORARY'>('MONTHLY');
  const [currency, setCurrency] = useState('INR');
  const [error, setError] = useState('');
  const mutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => graphqlRequest(createBudgetMutation, { input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      onClose();
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const startDate = String(form.get('startDate'));
      const endDate = type === 'TEMPORARY' ? String(form.get('endDate')) : null;
      if (endDate && endDate < startDate) throw new Error('End date must be after the start date.');
      mutation.mutate({
        name: String(form.get('name')).trim(),
        type,
        reportingCurrency: currency,
        amountMinor: parseMajorToMinor(String(form.get('amount')), currency),
        startDate,
        endDate,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Check the budget details.');
    }
  };

  const mutationError = mutation.error instanceof Error ? mutation.error.message : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a budget"
      description="Run an everyday plan and a fixed-date journey side by side."
    >
      <form className="form-stack" onSubmit={submit}>
        <fieldset className="choice-grid">
          <legend>Budget type</legend>
          <label className={type === 'MONTHLY' ? 'choice-card choice-card--active' : 'choice-card'}>
            <input
              type="radio"
              name="type"
              value="MONTHLY"
              checked={type === 'MONTHLY'}
              onChange={() => setType('MONTHLY')}
            />
            <CircleDollarSign size={21} />
            <span>
              <strong>Monthly</strong>
              <small>Recurring everyday plan</small>
            </span>
          </label>
          <label
            className={type === 'TEMPORARY' ? 'choice-card choice-card--active' : 'choice-card'}
          >
            <input
              type="radio"
              name="type"
              value="TEMPORARY"
              checked={type === 'TEMPORARY'}
              onChange={() => setType('TEMPORARY')}
            />
            <Route size={21} />
            <span>
              <strong>Temporary</strong>
              <small>Trip, event or move</small>
            </span>
          </label>
        </fieldset>

        <label className="form-field">
          <span>Budget name</span>
          <input
            name="name"
            required
            maxLength={60}
            placeholder={type === 'MONTHLY' ? 'September monthly' : 'Portugal coast trip'}
          />
        </label>

        <div className="form-row">
          <label className="form-field">
            <span>Currency</span>
            <select
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {supportedCurrencies.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="form-field form-field--grow">
            <span>Total budget</span>
            <input
              name="amount"
              required
              inputMode="decimal"
              placeholder={currency === 'JPY' ? '320000' : '1200.00'}
            />
          </label>
        </div>

        <div className="form-row">
          <label className="form-field form-field--grow">
            <span>{type === 'MONTHLY' ? 'Month starts' : 'Start date'}</span>
            <span className="input-with-icon">
              <CalendarDays size={17} />
              <input name="startDate" type="date" required defaultValue={todayIso()} />
            </span>
          </label>
          {type === 'TEMPORARY' && (
            <label className="form-field form-field--grow">
              <span>End date</span>
              <span className="input-with-icon">
                <CalendarDays size={17} />
                <input name="endDate" type="date" required />
              </span>
            </label>
          )}
        </div>

        {(error || mutationError) && (
          <p className="form-error" role="alert">
            {error || mutationError}
          </p>
        )}
        <div className="form-actions">
          <button className="secondary-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create budget'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
