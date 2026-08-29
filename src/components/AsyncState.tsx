import { AlertTriangle, LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading your plan…' }: { label?: string }) {
  return (
    <div className="state-card" role="status">
      <LoaderCircle className="spin" size={24} />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <AlertTriangle size={24} />
      <div>
        <strong>We couldn’t load this view.</strong>
        <p>{message}</p>
      </div>
      {retry && (
        <button className="secondary-button" type="button" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}
