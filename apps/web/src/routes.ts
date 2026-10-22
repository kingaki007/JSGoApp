/** Defines the two public pages without importing editor code into the landing-page bundle. */
export type Page = 'home' | 'playground' | 'not-found';

/** @param pathname URL path without query parameters or hash; trailing slashes are accepted. */
export function resolvePage(pathname: string): Page {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/' || path === '/index.html') return 'home';
  if (path === '/playground') return 'playground';
  return 'not-found';
}
