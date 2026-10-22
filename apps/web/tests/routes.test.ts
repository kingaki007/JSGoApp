/** Verifies direct page URLs, canonical path handling, and unknown-page behavior. */
import { expect, it } from 'vitest';
import { resolvePage } from '../src/routes';

it('reserves the root for the landing page and /playground for the editor', () => {
  expect(resolvePage('/')).toBe('home');
  expect(resolvePage('/index.html')).toBe('home');
  expect(resolvePage('/playground')).toBe('playground');
  expect(resolvePage('/playground/')).toBe('playground');
});
it('does not turn unknown or nested URLs into the editor', () => {
  expect(resolvePage('/somewhere')).toBe('not-found');
  expect(resolvePage('/playground/other')).toBe('not-found');
});
