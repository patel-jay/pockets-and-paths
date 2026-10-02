import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, RotateCcw } from 'lucide-react';
import { createRefundMutation, graphqlRequest, updateRefundMutation } from '../lib/graphql';
import { formatMoney, minorToMajorInput, parseMajorToMinor, todayIso } from '../lib/money';
import type { Expense, Refund } from '../types/app';
import type { CreateRefundInput, UpdateRefundInput } from '../types/inputs';
import { Modal } from './Modal';

type Props = {
  open: boolean;
  expense: Expense;
  refund?: Refund;
  locale?: string;
  onClose: () => void;
};

export function RefundModal({ open, expense, refund, locale = 'en-IN', onClose }: Props) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [error, setError] = useState('');
  const currency = expense.amount.currency;
  const availableMinor = (
    BigInt(expense.netAmount.minor) + BigInt(refund?.amount.minor ?? '0')
  ).toString();
  const mutation = useMutation({
    mutationFn: async (input: CreateRefundInput | UpdateRefundInput) => {
      if (refund) {
        await graphqlRequest(updateRefundMutation, { input: input as UpdateRefundInput });
      } else {
        await graphqlRequest(createRefundMutation, { input: input as CreateRefundInput });
      }
    },
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
      const refundDate = String(form.get('refundDate'));
      const notes = String(form.get('notes') || '').trim() || null;
      if (refund) {
        const amountMinor = parseMajorToMinor(String(form.get('amount')), currency);
        if (BigInt(amountMinor) > BigInt(availableMinor)) {
          throw new Error(
            `The refund cannot exceed ${formatMoney(availableMinor, currency, locale)}.`,
          );
        }
        mutation.mutate({ refundId: refund.id, amountMinor, refundDate, notes });
        return;
      }

      const amountMinor =
        kind === 'PARTIAL' ? parseMajorToMinor(String(form.get('amount')), currency) : null;
      if (amountMinor && BigInt(amountMinor) > BigInt(expense.netAmount.minor)) {
        throw new Error(
          `The refund cannot exceed ${formatMoney(expense.netAmount.minor, currency, locale)}.`,
        );
      }
      mutation.mutate({ expenseId: expense.id, kind, amountMinor, refundDate, notes });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Check the refund details.');
    }
  };

  const mutationError = mutation.error instanceof Error ? mutation.error.message : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={refund ? 'Edit refund' : 'Record refund'}
      description="Record money only after it has returned to you. The original expense will remain in the ledger."
    >
      <div className="refund-source">
        <span>
          <RotateCcw size={18} aria-hidden="true" />
        </span>
        <div>
          <small>Original expense</small>
          <strong>{expense.title}</strong>
          <p>
            {formatMoney(expense.amount.minor, currency, locale)} · {expense.budgetName}
          </p>
        </div>
      </div>

      <form className="form-stack" onSubmit={submit}>
        {!refund && (
          <fieldset className="choice-grid">
            <legend>Refund type</legend>
            <label className={kind === 'FULL' ? 'choice-card choice-card--active' : 'choice-card'}>
              <input
                type="radio"
                name="kind"
                value="FULL"
                checked={kind === 'FULL'}
                onChange={() => setKind('FULL')}
              />
              <span>
                <strong>Full refund</strong>
                <small>{formatMoney(expense.netAmount.minor, currency, locale)} remaining</small>
              </span>
            </label>
            <label
              className={kind === 'PARTIAL' ? 'choice-card choice-card--active' : 'choice-card'}
            >
              <input
                type="radio"
                name="kind"
                value="PARTIAL"
                checked={kind === 'PARTIAL'}
                onChange={() => setKind('PARTIAL')}
              />
              <span>
                <strong>Partial refund</strong>
                <small>Enter the returned amount</small>
              </span>
            </label>
          </fieldset>
        )}

        {(refund || kind === 'PARTIAL') && (
          <label className="form-field">
            <span>Refund amount in {currency}</span>
            <input
              name="amount"
              required
              inputMode="decimal"
              autoFocus={!refund && kind === 'PARTIAL'}
              defaultValue={
                refund ? minorToMajorInput(refund.amount.minor, refund.amount.currency) : ''
              }
              placeholder={currency === 'JPY' ? '12000' : '120.00'}
            />
            <small>Up to {formatMoney(availableMinor, currency, locale)} can be refunded.</small>
          </label>
        )}

        <label className="form-field">
          <span>Date received</span>
          <span className="input-with-icon">
            <CalendarDays size={17} />
            <input
              name="refundDate"
              type="date"
              required
              min={expense.expenseDate}
              max={todayIso()}
              defaultValue={refund?.refundDate ?? todayIso()}
            />
          </span>
          <small>This date controls when the refund appears in cash-flow analysis.</small>
        </label>

        <label className="form-field">
          <span>
            Notes <small>Optional</small>
          </span>
          <textarea
            name="notes"
            maxLength={300}
            rows={3}
            defaultValue={refund?.notes ?? ''}
            placeholder="Cancellation reference or anything useful later"
          />
        </label>

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
            {mutation.isPending
              ? 'Saving…'
              : refund
                ? 'Save refund'
                : kind === 'FULL'
                  ? 'Record full refund'
                  : 'Record partial refund'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
