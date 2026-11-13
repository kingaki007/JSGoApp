/** Runs inside the sandboxed execution page: accepts one run request and posts its output to the app. */
import { executeCode, type FrameMessage, type FrameRequest } from './execution';

/** @param message Output, completion, or readiness notice for the app that owns this page. */
function post(message: FrameMessage) {
  // The page has an opaque origin, so the target origin cannot be named; the app checks the sender.
  parent.postMessage(message, '*');
}

let started = false;
window.addEventListener('message', (event: MessageEvent<Partial<FrameRequest> | null>) => {
  const request = event.data;
  // Only the embedding app may start a run, and each page runs exactly one snippet.
  if (event.source !== parent || started || !request) return;
  if (typeof request.id !== 'string' || typeof request.code !== 'string') return;
  started = true;
  const { id } = request;
  void executeCode(
    id,
    request.code,
    (line, sourceLine, values) => post({ type: 'output', id, line, sourceLine, values }),
    request.showUndefined === true,
    request.inspect === true,
    typeof request.timeoutMs === 'number' ? request.timeoutMs : undefined,
  ).then((result) => post({ type: 'complete', result }));
});
post({ type: 'ready' });
