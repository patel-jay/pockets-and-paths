import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="route-message" aria-labelledby="not-found-title">
      <Compass size={34} aria-hidden="true" />
      <p className="eyebrow">Path not found</p>
      <h1 id="not-found-title">This route is not part of the journey.</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <Link className="primary-button" to="/">
        <ArrowLeft size={17} />
        Return to overview
      </Link>
    </section>
  );
}
