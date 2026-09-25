import { useEffect, useRef, useState } from 'react';

type TurnstileOptions = {
  sitekey: string;
  theme: 'light';
  size: 'flexible';
  action: string;
  callback: (token: string) => void;
  'expired-callback': () => void;
  'error-callback': () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  let scriptElement: HTMLScriptElement | null = null;
  const pending = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]');
    const script = existing ?? document.createElement('script');
    scriptElement = script;
    const timeout = window.setTimeout(
      () => reject(new Error('Human verification did not load.')),
      15_000,
    );
    const ready = () => {
      window.clearTimeout(timeout);
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Human verification did not load.'));
    };
    const failed = () => {
      window.clearTimeout(timeout);
      reject(new Error('Human verification did not load.'));
    };
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', failed, { once: true });
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = 'true';
      document.head.appendChild(script);
    }
  });
  scriptPromise = pending.catch((error: unknown) => {
    scriptPromise = null;
    scriptElement?.remove();
    throw error;
  });
  return scriptPromise;
}

export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let widgetId: string | null = null;
    onToken('');
    loadTurnstile()
      .then((turnstile) => {
        if (!active || !container.current) return;
        widgetId = turnstile.render(container.current, {
          sitekey: siteKey,
          theme: 'light',
          size: 'flexible',
          action: 'register',
          callback: (token) => {
            setError('');
            onToken(token);
          },
          'expired-callback': () => onToken(''),
          'error-callback': () => {
            onToken('');
            setError('Human verification needs another try.');
          },
        });
      })
      .catch(() => {
        if (active) setError('Human verification could not load.');
      });

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [attempt, onToken, siteKey]);

  return (
    <div className="turnstile-field">
      <div ref={container} />
      {error && (
        <div role="alert">
          <p className="form-error">{error}</p>
          <button
            className="login-card__link"
            type="button"
            onClick={() => {
              setError('');
              setAttempt((value) => value + 1);
            }}
          >
            Retry verification
          </button>
        </div>
      )}
    </div>
  );
}
