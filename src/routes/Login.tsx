import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  LockKeyhole,
  Map,
  ShieldCheck,
  UserRoundPlus,
  WalletCards,
} from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { demoCredentials, getAuthConfig, type AuthConfig } from '../lib/auth';
import { useAuth } from '../lib/auth-context';

export function LoginPage() {
  const { login, loginDemo, register } = useAuth();
  const [entryMode, setEntryMode] = useState<'account' | 'demo'>('demo');
  const [accountView, setAccountView] = useState<'login' | 'register'>('login');
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [configGeneration, setConfigGeneration] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const activeEntryMode = config
    ? !config.demoEnabled
      ? 'account'
      : !config.personalAccountsEnabled
        ? 'demo'
        : entryMode
    : entryMode;

  useEffect(() => {
    let active = true;
    getAuthConfig()
      .then((result) => {
        if (active) setConfig(result);
      })
      .catch(() => {
        if (active) setConfigError(true);
      });
    return () => {
      active = false;
    };
  }, [configGeneration]);

  const receiveTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);

  const chooseEntryMode = (mode: 'account' | 'demo') => {
    setEntryMode(mode);
    setError('');
  };

  const submitDemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await loginDemo(String(form.get('email')), String(form.get('password')));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demo account is unavailable.');
      setPending(false);
    }
  };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get('email')), String(form.get('password')));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your account is unavailable.');
      setPending(false);
    }
  };

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password !== String(form.get('confirmPassword'))) {
      setError('The two passwords do not match.');
      return;
    }
    if (!turnstileToken) {
      setError('Complete the human verification first.');
      return;
    }

    setPending(true);
    setError('');
    try {
      await register({
        displayName: String(form.get('displayName')),
        email: String(form.get('email')),
        password,
        inviteCode: String(form.get('inviteCode')),
        turnstileToken,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your account could not be created.');
      setPending(false);
      setTurnstileToken('');
      setTurnstileGeneration((value) => value + 1);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="login-product-title">
        <div className="login-brand">
          <BrandMark />
          <span>
            Pockets <i>&</i> Paths
          </span>
        </div>
        <div className="login-story__copy">
          <p className="eyebrow">One plan for every pace</p>
          <h1 id="login-product-title">Daily life and distant paths, budgeted together.</h1>
          <p>
            Keep your monthly essentials moving while you plan a trip, event, or temporary chapter
            in another currency.
          </p>
        </div>
        <div className="login-features">
          <span>
            <WalletCards size={18} />
            Monthly and temporary budgets
          </span>
          <span>
            <Map size={18} />
            One clear currency per budget
          </span>
          <span>
            <ShieldCheck size={18} />
            {config?.demoEnabled === false
              ? 'Private account access'
              : 'An isolated demo for this browser'}
          </span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <span className="login-card__icon" aria-hidden="true">
            {accountView === 'register' && activeEntryMode === 'account' ? (
              <UserRoundPlus size={23} />
            ) : (
              <LockKeyhole size={23} />
            )}
          </span>
          <div className="login-mode-switch" aria-label="Sign-in options">
            {config?.demoEnabled !== false && (
              <button
                type="button"
                className={activeEntryMode === 'demo' ? 'login-mode-switch__active' : ''}
                aria-pressed={activeEntryMode === 'demo'}
                onClick={() => chooseEntryMode('demo')}
              >
                Try the demo
              </button>
            )}
            {config?.personalAccountsEnabled !== false && (
              <button
                type="button"
                className={activeEntryMode === 'account' ? 'login-mode-switch__active' : ''}
                aria-pressed={activeEntryMode === 'account'}
                onClick={() => chooseEntryMode('account')}
              >
                Personal account
              </button>
            )}
          </div>

          {activeEntryMode === 'demo' ? (
            <form className="login-card__form" onSubmit={submitDemo}>
              <p className="eyebrow">Interactive demo</p>
              <h2 id="login-title">Sign in to the demo</h2>
              <p className="login-card__intro">
                Use the credentials below. Your changes stay separate from other visitors.
              </p>
              <label className="form-field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  defaultValue={demoCredentials.email}
                />
              </label>
              <label className="form-field">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  defaultValue={demoCredentials.password}
                />
              </label>
              <div className="demo-credentials">
                <span>Demo account</span>
                <code>{demoCredentials.email}</code>
                <code>{demoCredentials.password}</code>
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-button login-button" type="submit" disabled={pending}>
                {pending ? 'Opening your demo…' : 'Enter demo account'}
                {!pending && <ArrowRight size={18} />}
              </button>
              <small className="login-card__note">
                Demo changes stay in this browser’s isolated sandbox.
              </small>
            </form>
          ) : accountView === 'login' ? (
            <form className="login-card__form" onSubmit={submitLogin}>
              <p className="eyebrow">Private workspace</p>
              <h2 id="login-title">Sign in to your account</h2>
              <p className="login-card__intro">
                Your plans stay connected to your account across devices.
              </p>
              <label className="form-field">
                <span>Email</span>
                <input name="email" type="email" required autoComplete="username" />
              </label>
              <label className="form-field">
                <span>Password</span>
                <input
                  name="password"
                  type="password"
                  required
                  maxLength={128}
                  autoComplete="current-password"
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary-button login-button" type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
                {!pending && <ArrowRight size={18} />}
              </button>
              {config?.registrationEnabled && (
                <button
                  className="login-card__link"
                  type="button"
                  onClick={() => {
                    setAccountView('register');
                    setError('');
                  }}
                >
                  Create an invite-only account
                </button>
              )}
            </form>
          ) : (
            <form
              className="login-card__form login-card__form--register"
              onSubmit={submitRegistration}
            >
              <p className="eyebrow">Invite-only registration</p>
              <h2 id="login-title">Create your account</h2>
              <p className="login-card__intro">
                Register once, then sign in normally from your phone or computer.
              </p>
              {configError ? (
                <div className="auth-configuration-note" role="alert">
                  <span>Registration settings could not be loaded.</span>
                  <button
                    className="login-card__link"
                    type="button"
                    onClick={() => {
                      setConfig(null);
                      setConfigError(false);
                      setConfigGeneration((value) => value + 1);
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : config === null ? (
                <div className="auth-configuration-note" role="status">
                  Checking registration settings…
                </div>
              ) : !config.registrationEnabled ? (
                <div className="auth-configuration-note" role="status">
                  Registration needs the owner’s Turnstile and invite-code settings before it can
                  accept an account.
                </div>
              ) : (
                <>
                  <label className="form-field">
                    <span>Display name</span>
                    <input name="displayName" required maxLength={60} autoComplete="name" />
                  </label>
                  <label className="form-field">
                    <span>Email</span>
                    <input name="email" type="email" required autoComplete="username" />
                  </label>
                  <div className="form-row">
                    <label className="form-field form-field--grow">
                      <span>Password</span>
                      <input
                        name="password"
                        type="password"
                        required
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </label>
                    <label className="form-field form-field--grow">
                      <span>Confirm password</span>
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
                  <p className="form-note">Use 12–128 characters. Longer passphrases work well.</p>
                  <label className="form-field">
                    <span>Registration invite code</span>
                    <input
                      name="inviteCode"
                      type="password"
                      required
                      maxLength={200}
                      autoComplete="off"
                    />
                    <small>This private code is set by the app owner.</small>
                  </label>
                  <TurnstileWidget
                    key={turnstileGeneration}
                    siteKey={config.turnstileSiteKey!}
                    onToken={receiveTurnstileToken}
                  />
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="primary-button login-button"
                    type="submit"
                    disabled={pending || !turnstileToken}
                  >
                    {pending ? 'Creating account…' : 'Create account'}
                    {!pending && <ArrowRight size={18} />}
                  </button>
                </>
              )}
              <button
                className="login-card__link"
                type="button"
                onClick={() => {
                  setAccountView('login');
                  setError('');
                }}
              >
                Back to personal sign in
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
