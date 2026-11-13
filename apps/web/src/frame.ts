/** Runs inside the sandboxed execution page: accepts one run request and posts its output to the app. */
import { executeCode, type FrameMessage, type FrameRequest } from './execution';

/** @param message Output, completion, or readiness notice for the app that owns this page. */
function post(message: FrameMessage) {
  // The page has an opaque origin, so the target origin cannot be named; the app checks the sender.
  parent.postMessage(message, '*');
}

/**
 * Waits until the page knows its size. A new page can report a zero-sized window for a moment,
 * which would break code that sizes a canvas from `window.innerWidth` on its first line.
 * @returns Resolves at once when sized, otherwise as soon as a size arrives or after one second.
 */
function whenSized(): Promise<void> {
  if (window.innerWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    const startedAt = Date.now();
    /** Checks again shortly; a page that stays unsized (for example while hidden) still runs. */
    const check = () => {
      if (window.innerWidth > 0 || Date.now() - startedAt >= 1000) resolve();
      else setTimeout(check, 20);
    };
    check();
  });
}

let started = false;
window.addEventListener('message', (event: MessageEvent<Partial<FrameRequest> | null>) => {
  const request = event.data;
  // Only the embedding app may start a run, and each page runs exactly one snippet.
  if (event.source !== parent || started || !request) return;
  if (typeof request.id !== 'string' || typeof request.code !== 'string') return;
  started = true;
  const { id } = request;
  const code = request.code;
  void whenSized()
    .then(() =>
      executeCode(
        id,
        code,
        (line, sourceLine, values, level) =>
          post({ type: 'output', id, line, sourceLine, values, level }),
        request.showUndefined === true,
        request.inspect === true,
        typeof request.timeoutMs === 'number' ? request.timeoutMs : undefined,
      ),
    )
    .then((result) => post({ type: 'complete', result }));
});
post({ type: 'ready' });
