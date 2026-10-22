/** Selects the landing page or lazily loaded playground from the current document URL. */
import { lazy, Suspense, useEffect } from 'react';
import LandingPage from './LandingPage';
import { resolvePage } from './routes';

const Playground = lazy(() => import('./App'));

/** Renders the requested page; normal links preserve browser navigation and direct URL loading. */
export default function Root() {
  const page = resolvePage(window.location.pathname);
  useEffect(() => {
    document.title =
      page === 'playground'
        ? 'Playground — JSGoApp'
        : page === 'home'
          ? 'JSGoApp — A space for your next idea'
          : 'Page not found — JSGoApp';
  }, [page]);
  if (page === 'home') return <LandingPage />;
  if (page === 'not-found')
    return (
      <main className="route-message">
        <p className="section-label">404</p>
        <h1>This page wandered off.</h1>
        <p>There is still plenty to explore.</p>
        <a className="landing-button primary" href="/">
          Back to home
        </a>
      </main>
    );
  return (
    <Suspense
      fallback={
        <main className="route-message" role="status">
          Opening your playground…
        </main>
      }
    >
      <Playground />
    </Suspense>
  );
}
