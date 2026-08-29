import { AlertTriangle, RotateCcw } from 'lucide-react';
import { isRouteErrorResponse, useRouteError } from 'react-router';

export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected problem interrupted this view.';

  return (
    <main className="route-error" aria-labelledby="route-error-title">
      <section className="route-message">
        <AlertTriangle size={34} aria-hidden="true" />
        <p className="eyebrow">Something went off course</p>
        <h1 id="route-error-title">This view could not be opened.</h1>
        <p>{message}</p>
        <button className="primary-button" type="button" onClick={() => window.location.reload()}>
          <RotateCcw size={17} />
          Reload the app
        </button>
      </section>
    </main>
  );
}
