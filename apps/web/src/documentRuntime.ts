/** Owns a sandboxed DOM execution frame and validates its output independently of the worker runner. */
import type { RunRequest, RunResult, RuntimeAdapter } from '@code-editor/core';
import bootstrap from './preview-bootstrap.js?raw';

/**
 * Builds a self-contained preview without letting source text break out of its script element.
 * @param request Unique run identifier and already compiled JavaScript.
 */
export function createPreviewDocument(request: RunRequest): string {
  const payload = JSON.stringify({ id: request.id, code: request.code }).replaceAll('<', '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:24px;font:16px/1.5 system-ui;color:#18202e;background:white}button,input{font:inherit}</style>
</head><body><script>${bootstrap}\nstartPreview(${payload});</script></body></html>`;
}

/** Runs DOM code once per document; successful runs retain event handlers until explicitly stopped. */
export class DocumentRuntime implements RuntimeAdapter {
  private frame: HTMLIFrameElement | null = null;
  private cleanup?: () => void;

  /** @param frame Mounted preview element; null detaches and cancels its active execution. */
  attach(frame: HTMLIFrameElement | null) {
    if (frame === this.frame) return;
    this.stop();
    this.frame = frame;
  }

  /**
   * Loads a fresh opaque-origin document, streams output, and awaits top-level completion.
   * @param request Compiled browser source and unique run identifier.
   * @param onOutput Receives bounded console text, including logs from later DOM interactions.
   */
  run(request: RunRequest, onOutput?: (line: string) => void): Promise<RunResult> {
    this.stop();
    const frame = this.frame;
    if (!frame || request.environment !== 'browser') {
      return Promise.resolve({ id: request.id, lines: [], error: 'Web preview is unavailable.' });
    }
    return new Promise((resolve) => {
      const lines: string[] = [];
      let settled = false;
      let size = 0;
      /** @param error Optional top-level failure; successful documents stay interactive. */
      function finish(error?: string) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ id: request.id, lines: [...lines], ...(error ? { error } : {}) });
      }
      /** @param event Untrusted cross-window message; only this frame and run may report output. */
      function receive(event: MessageEvent) {
        const data = event.data;
        if (
          event.source !== frame!.contentWindow ||
          event.origin !== 'null' ||
          !data ||
          data.id !== request.id
        )
          return;
        if (
          data.type === 'output' &&
          typeof data.line === 'string' &&
          lines.length < 500 &&
          size < 100_000
        ) {
          const line = data.line.slice(0, Math.min(10_000, 100_000 - size));
          size += line.length;
          lines.push(line);
          onOutput?.(line);
        } else if (data.type === 'complete') {
          finish(typeof data.error === 'string' ? data.error.slice(0, 10_000) : undefined);
        }
      }
      // This timer cancels pending asynchronous work, but cannot preempt a synchronous DOM loop.
      const timer = setTimeout(() => {
        finish('Web document exceeded 5 seconds. Preview reset.');
        this.stop();
      }, 5000);
      this.cleanup = () => {
        window.removeEventListener('message', receive);
        finish('Execution stopped.');
      };
      window.addEventListener('message', receive);
      frame.srcdoc = createPreviewDocument(request);
    });
  }

  /** Removes message listeners and the document, including event handlers and pending timers. */
  stop() {
    this.cleanup?.();
    this.cleanup = undefined;
    if (this.frame) this.frame.srcdoc = '';
  }
}
