import { useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, Map, ShieldCheck, WalletCards } from 'lucide-react';
import { demoCredentials } from '../lib/auth';
import { useAuth } from '../lib/auth-context';

export function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get('email')), String(form.get('password')));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demo account is unavailable.');
      setPending(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-story" aria-labelledby="login-product-title">
        <div className="login-brand">
          <span className="brand__mark" aria-hidden="true">
            <WalletCards size={20} strokeWidth={2.2} />
          </span>
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
            Original and reporting currencies
          </span>
          <span>
            <ShieldCheck size={18} />
            An isolated demo for this browser
          </span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <form className="login-card" onSubmit={submit}>
          <span className="login-card__icon" aria-hidden="true">
            <LockKeyhole size={23} />
          </span>
          <p className="eyebrow">Portfolio preview</p>
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
            Demo access only—this is not production authentication.
          </small>
        </form>
      </section>
    </main>
  );
}
