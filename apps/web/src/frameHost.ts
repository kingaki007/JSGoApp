/** Creates the sandboxed page that gives Browser snippets a real document and window. */
import type { FrameRequest } from './execution';

export interface FrameHost {
  /** @param request Run request delivered to the page once it reports readiness. */
  post(request: FrameRequest): void;
  /** @param listener Receives untrusted messages posted by this page only. */
  onMessage(listener: (message: unknown) => void): void;
  /** Removes the page, which also stops its timers, listeners, and pending work. */
  dispose(): void;
}

/**
 * Builds the page's HTML around the bundled runner script.
 * @param runner Self-contained runner script, already safe to place inside a script element.
 * @returns Document with the `#root` mount point that UI libraries expect.
 */
export function frameDocument(runner: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>JSGoApp page</title></head><body><div id="root"></div><script>${runner}</script></body></html>`;
}

/**
 * Starts a fresh page for one run.
 * The sandbox grants scripts only: the page has an opaque origin, so snippets cannot read the
 * app's storage, cookies, or DOM, and cannot navigate or open windows.
 * @param mount Element of the Web view that displays the page; null keeps the page off screen.
 */
export async function createFrameHost(mount: HTMLElement | null = null): Promise<FrameHost> {
  const { default: runner } = await import('virtual:frame-runner');
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts');
  if (mount) {
    frame.className = 'web-view-frame';
    frame.title = 'Web view';
  } else {
    frame.className = 'runner-frame';
    frame.title = 'Code execution page';
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
  }
  frame.srcdoc = frameDocument(runner);
  const listeners: Array<(message: unknown) => void> = [];
  /** @param event Window message; only those sent by this page's own window are forwarded. */
  const receive = (event: MessageEvent) => {
    if (event.source === frame.contentWindow)
      for (const listener of listeners) listener(event.data);
  };
  window.addEventListener('message', receive);
  (mount ?? document.body).append(frame);
  return {
    /** @param request Run request for the page's runner. */
    post: (request) => frame.contentWindow?.postMessage(request, '*'),
    /** @param listener Message handler added for the lifetime of this page. */
    onMessage: (listener) => void listeners.push(listener),
    /** Detaches the listener and removes the page from the document. */
    dispose() {
      window.removeEventListener('message', receive);
      frame.remove();
    },
  };
}
