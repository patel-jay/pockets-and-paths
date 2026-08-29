import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LogOut, RotateCcw } from 'lucide-react';
import { ErrorState, LoadingState } from '../components/AsyncState';
import { PageHeader } from '../components/PageHeader';
import { graphqlRequest, updateProfileMutation } from '../lib/graphql';
import { supportedCurrencies } from '../lib/money';
import { useProfile } from '../lib/queries';
import { useAuth } from '../lib/auth-context';
import type { UpdateProfileInput } from '../types/inputs';

export function SettingsPage() {
  const { logout, reset } = useAuth();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [sessionPending, setSessionPending] = useState<'reset' | 'logout' | null>(null);
  const [sessionError, setSessionError] = useState('');
  useEffect(() => {
    if (saved) {
      const id = window.setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(id);
    }
  }, [saved]);
  const mutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => graphqlRequest(updateProfileMutation, { input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setSaved(true);
    },
  });

  if (profile.isLoading) return <LoadingState label="Loading profile…" />;
  if (profile.isError)
    return <ErrorState message={profile.error.message} retry={() => profile.refetch()} />;
  if (!profile.data) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutation.mutate({
      displayName: String(form.get('displayName')).trim(),
      baseCurrency: String(form.get('baseCurrency')),
      locale: String(form.get('locale')),
    });
  };

  const resetSession = async () => {
    if (!window.confirm('Reset this browser’s demo budgets and expenses to the original examples?'))
      return;
    setSessionPending('reset');
    setSessionError('');
    try {
      await reset();
    } catch (caught) {
      setSessionError(caught instanceof Error ? caught.message : 'The demo could not be reset.');
    } finally {
      setSessionPending(null);
    }
  };

  const signOut = async () => {
    setSessionPending('logout');
    setSessionError('');
    try {
      await logout();
    } catch (caught) {
      setSessionError(caught instanceof Error ? caught.message : 'The demo could not sign out.');
    } finally {
      setSessionPending(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Your defaults"
        title="Settings"
        copy="Choose how totals and dates are presented across your plans."
      />
      <section className="settings-card">
        <form className="form-stack" onSubmit={submit}>
          <label className="form-field">
            <span>Display name</span>
            <input
              name="displayName"
              required
              maxLength={60}
              defaultValue={profile.data.profile.displayName}
            />
          </label>
          <div className="form-row">
            <label className="form-field form-field--grow">
              <span>Profile currency</span>
              <select name="baseCurrency" defaultValue={profile.data.profile.baseCurrency}>
                {supportedCurrencies.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
              <small>Combined totals are converted into this currency.</small>
            </label>
            <label className="form-field form-field--grow">
              <span>Date and number format</span>
              <select name="locale" defaultValue={profile.data.profile.locale}>
                <option value="en-IN">English (India)</option>
                <option value="en-GB">English (UK)</option>
                <option value="en-US">English (US)</option>
                <option value="de-DE">German (Germany)</option>
              </select>
            </label>
          </div>
          <div className="notice-card">
            <strong>Local demo profile</strong>
            <p>
              This app creates an anonymous profile for this browser. No email address or
              third-party sign-in is required.
            </p>
          </div>
          {mutation.error && (
            <p className="form-error" role="alert">
              {(mutation.error as Error).message}
            </p>
          )}
          <div className="form-actions form-actions--start">
            <button className="primary-button" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save settings'}
            </button>
            {saved && (
              <span className="saved-message">
                <CheckCircle2 size={17} />
                Saved
              </span>
            )}
          </div>
        </form>
      </section>
      <section className="settings-card session-card" aria-labelledby="demo-session-title">
        <div>
          <p className="eyebrow">Browser sandbox</p>
          <h2 id="demo-session-title">Demo session</h2>
          <p>
            Your data is isolated from other visitors. Reset it to the original examples or sign out
            without deleting it.
          </p>
        </div>
        <div className="session-card__actions">
          <button
            className="secondary-button"
            type="button"
            disabled={sessionPending !== null}
            onClick={() => void resetSession()}
          >
            <RotateCcw size={16} />
            {sessionPending === 'reset' ? 'Resetting…' : 'Reset demo data'}
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={sessionPending !== null}
            onClick={() => void signOut()}
          >
            <LogOut size={16} />
            {sessionPending === 'logout' ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
        {sessionError && (
          <p className="form-error" role="alert">
            {sessionError}
          </p>
        )}
      </section>
    </>
  );
}
