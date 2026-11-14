/** Runs inside the sandboxed execution page: accepts one run request and posts its output to the app. */
import { readEnv } from '@code-editor/core/env';
import { executeCode, watchFailures, type FrameMessage, type FrameRequest } from './execution';
import { createLiveInspector } from './liveInspector';

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
let runId: string | undefined;
let inspectionEnabled = false;
const inspector = createLiveInspector();
window.addEventListener('message', (event: MessageEvent<Partial<FrameRequest> | null>) => {
  const request = event.data;
  // Only the embedding app may start a run, and each page runs exactly one snippet.
  if (event.source !== parent || !request) return;
  const command = request as Record<string, unknown>;
  if (command.type === 'inspect') {
    if (
      !inspectionEnabled ||
      command.id !== runId ||
      typeof command.requestId !== 'string' ||
      typeof command.reference !== 'string' ||
      command.requestId.length > 80 ||
      command.reference.length > 80
    )
      return;
    try {
      post({
        type: 'inspection',
        id: runId!,
        requestId: command.requestId,
        value: inspector.expand(command.reference),
      });
    } catch {
      post({
        type: 'inspection',
        id: runId!,
        requestId: command.requestId,
        error: 'This value could not be inspected.',
      });
    }
    return;
  }
  if (started) return;
  if (typeof request.id !== 'string' || typeof request.code !== 'string') return;
  started = true;
  const { id } = request;
  runId = id;
  inspectionEnabled = request.inspect === true;
  const code = request.code;
  void whenSized()
    .then(() =>
      executeCode(
        id,
        code,
        (line, sourceLine, values, level) =>
          post({ type: 'output', id, line, sourceLine, values, level }),
        {
          showUndefined: request.showUndefined === true,
          inspect: request.inspect === true,
          inspectArguments: inspectionEnabled ? inspector.inspect : undefined,
          timeoutMs: typeof request.timeoutMs === 'number' ? request.timeoutMs : undefined,
          failures: watchFailures(window),
          env: readEnv(request.env) ?? undefined,
        },
      ),
    )
    .then((result) => post({ type: 'complete', result }));
});
post({ type: 'ready' });
