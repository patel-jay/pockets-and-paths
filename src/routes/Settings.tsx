import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, KeyRound, LogOut, RotateCcw, ShieldCheck } from 'lucide-react';
import { ErrorState, LoadingState } from '../components/AsyncState';
import { PageHeader } from '../components/PageHeader';
import { graphqlRequest, updateProfileMutation } from '../lib/graphql';
import { supportedCurrencies } from '../lib/money';
import { useProfile } from '../lib/queries';
import { useAuth } from '../lib/auth-context';
import {
  changePassword,
  getAccountSessions,
  logoutOtherSessions,
  type AccountSessionSummary,
} from '../lib/auth';
import type { UpdateProfileInput } from '../types/inputs';

export function SettingsPage() {
  const { email, logout, mode, reset } = useAuth();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [sessionPending, setSessionPending] = useState<'reset' | 'logout' | null>(null);
  const [sessionError, setSessionError] = useState('');
  const [accountSessions, setAccountSessions] = useState<AccountSessionSummary[]>([]);
  const [accountPending, setAccountPending] = useState<'password' | 'sessions' | null>(null);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  useEffect(() => {
    if (saved) {
      const id = window.setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(id);
    }
  }, [saved]);
  useEffect(() => {
    if (mode !== 'account') return;
    void getAccountSessions()
      .then(({ sessions }) => setAccountSessions(sessions))
      .catch(() => setAccountSessions([]));
  }, [mode]);
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
      defaultCurrency: String(form.get('defaultCurrency')),
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

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const next = String(form.get('newPassword'));
    if (next !== String(form.get('confirmPassword'))) {
      setAccountError('The two new passwords do not match.');
      return;
    }
    setAccountPending('password');
    setAccountError('');
    setAccountMessage('');
    try {
      await changePassword(String(form.get('currentPassword')), next);
      formElement.reset();
      setAccountSessions((sessions) => sessions.filter((session) => session.current));
      setAccountMessage('Password updated. Other devices were signed out.');
    } catch (caught) {
      setAccountError(
        caught instanceof Error ? caught.message : 'The password could not be updated.',
      );
    } finally {
      setAccountPending(null);
    }
  };

  const signOutOthers = async () => {
    setAccountPending('sessions');
    setAccountError('');
    setAccountMessage('');
    try {
      const { revoked } = await logoutOtherSessions();
      setAccountSessions((sessions) => sessions.filter((session) => session.current));
      setAccountMessage(
        revoked
          ? `${revoked} other session${revoked === 1 ? '' : 's'} signed out.`
          : 'No other active sessions were found.',
      );
    } catch (caught) {
      setAccountError(
        caught instanceof Error ? caught.message : 'Other sessions could not be signed out.',
      );
    } finally {
      setAccountPending(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Your defaults"
        title="Settings"
        copy="Choose the defaults used when you create new plans."
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
              <span>Default budget currency</span>
              <select name="defaultCurrency" defaultValue={profile.data.profile.defaultCurrency}>
                {supportedCurrencies.map((currency) => (
                  <option key={currency}>{currency}</option>
                ))}
              </select>
              <small>New budgets start with this currency; existing budgets stay unchanged.</small>
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
          {mode === 'demo' ? (
            <div className="notice-card">
              <strong>Local demo profile</strong>
              <p>
                This app creates an anonymous profile for this browser. No email address or
                third-party sign-in is required.
              </p>
            </div>
          ) : (
            <div className="notice-card">
              <strong>Personal account</strong>
              <p>Signed in as {email}. Your plans follow this account across supported devices.</p>
            </div>
          )}
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
      <section className="settings-card session-card" aria-labelledby="export-title">
        <div>
          <p className="eyebrow">Your data</p>
          <h2 id="export-title">Export and backup</h2>
          <p>
            Download a spreadsheet-friendly expense ledger or a complete JSON copy of your data.
          </p>
        </div>
        <div className="session-card__actions">
          <a className="secondary-button" href="/api/export?format=csv" download>
            <Download size={16} />
            Expenses CSV
          </a>
          <a className="secondary-button" href="/api/export?format=json" download>
            <Download size={16} />
            Full JSON copy
          </a>
        </div>
      </section>
      {mode === 'account' && (
        <section className="settings-card account-security" aria-labelledby="security-title">
          <div>
            <p className="eyebrow">Account security</p>
            <h2 id="security-title">Password and sessions</h2>
            <p>
              {accountSessions.length} active session{accountSessions.length === 1 ? '' : 's'}.
              Changing your password also signs out every other device.
            </p>
          </div>
          <form className="form-stack" onSubmit={submitPassword}>
            <label className="form-field">
              <span>Current password</span>
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <div className="form-row">
              <label className="form-field form-field--grow">
                <span>New password</span>
                <input
                  name="newPassword"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
              <label className="form-field form-field--grow">
                <span>Confirm new password</span>
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            </div>
            <div className="form-actions form-actions--start">
              <button className="primary-button" type="submit" disabled={accountPending !== null}>
                <KeyRound size={16} />
                {accountPending === 'password' ? 'Updating…' : 'Change password'}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={accountPending !== null}
                onClick={() => void signOutOthers()}
              >
                <ShieldCheck size={16} />
                {accountPending === 'sessions' ? 'Signing out…' : 'Sign out other devices'}
              </button>
            </div>
            {accountMessage && <p className="saved-message">{accountMessage}</p>}
            {accountError && (
              <p className="form-error" role="alert">
                {accountError}
              </p>
            )}
          </form>
        </section>
      )}
      <section className="settings-card session-card" aria-labelledby="session-title">
        <div>
          <p className="eyebrow">{mode === 'demo' ? 'Browser sandbox' : 'Account access'}</p>
          <h2 id="session-title">{mode === 'demo' ? 'Demo session' : 'Personal session'}</h2>
          {mode === 'demo' ? (
            <p>
              Your data is isolated from other visitors. Reset it to the original examples or sign
              out without deleting it.
            </p>
          ) : (
            <p>Sign out on this device without deleting your budgets, categories, or expenses.</p>
          )}
        </div>
        <div className="session-card__actions">
          {mode === 'demo' && (
            <button
              className="secondary-button"
              type="button"
              disabled={sessionPending !== null}
              onClick={() => void resetSession()}
            >
              <RotateCcw size={16} />
              {sessionPending === 'reset' ? 'Resetting…' : 'Reset demo data'}
            </button>
          )}
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
