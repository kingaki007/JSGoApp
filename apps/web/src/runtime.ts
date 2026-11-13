/** Implements the Browser execution lifecycle with one disposable sandboxed page per run. */
import {
  normalizeSourceLine,
  type OutputListener,
  type RunRequest,
  type RunResult,
  type RuntimeAdapter,
} from '@code-editor/core';
import { readInspectedValues, type InspectedValue } from '@code-editor/core/inspect';
import { createFrameHost, type FrameHost } from './frameHost';

export const browserTimeoutMs = 5000;
// The page stops runaway loops itself; this extra time lets that clearer error arrive first.
const hostGraceMs = 500;

/**
 * Runs snippets in a page with a real document and window. The page shares the app's thread, so a
 * loop is stopped from inside the page; the host timer covers work that never finishes.
 */
export class BrowserRuntime implements RuntimeAdapter {
  private cancel?: () => void;
  private readonly createHost: () => Promise<FrameHost>;
  private readonly timeoutMs: number;

  /** @param options Page factory and time limit, replaceable in tests. */
  constructor({
    createHost = createFrameHost,
    timeoutMs = browserTimeoutMs,
  }: { createHost?: () => Promise<FrameHost>; timeoutMs?: number } = {}) {
    this.createHost = createHost;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Replaces any previous execution and resolves when the new run completes, fails, or is stopped.
   * @param request Unique run ID, executable JavaScript, and target environment.
   * @param onOutput Optional callback receiving each captured line and its code line as it arrives.
   */
  run(request: RunRequest, onOutput?: OutputListener): Promise<RunResult> {
    this.stop();
    if (request.environment !== 'browser') {
      return Promise.reject(new Error('Expected the Browser environment.'));
    }
    return new Promise((resolve) => {
      const lines: string[] = [];
      const sourceLines: number[] = [];
      const details: Array<InspectedValue[] | null> = [];
      let finished = false;
      let host: FrameHost | undefined;
      const seconds = Math.round(this.timeoutMs / 1000);
      /** @param error Optional failure; every exit removes the page and its timer exactly once. */
      const finish = (error?: string) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        host?.dispose();
        if (this.cancel === cancel) this.cancel = undefined;
        resolve({ id: request.id, lines, sourceLines, details, ...(error ? { error } : {}) });
      };
      /** Ends the run on Stop or replacement while keeping output already received. */
      const cancel = () => finish('Execution stopped.');
      const timer = setTimeout(
        () => finish(`Execution exceeded ${seconds} seconds.`),
        this.timeoutMs + hostGraceMs,
      );
      this.cancel = cancel;
      this.createHost().then(
        (created) => {
          if (finished) {
            created.dispose();
            return;
          }
          host = created;
          created.onMessage((message) => {
            if (finished || !message || typeof message !== 'object') return;
            const data = message as Record<string, unknown>;
            if (data.type === 'ready') {
              created.post({ ...request, timeoutMs: this.timeoutMs });
            } else if (data.type === 'output' && data.id === request.id) {
              if (typeof data.line !== 'string' || lines.length >= 500) return;
              const line = data.line.slice(0, 10_000);
              const sourceLine = normalizeSourceLine(data.sourceLine);
              const values = readInspectedValues(data.values);
              lines.push(line);
              sourceLines.push(sourceLine);
              details.push(values);
              onOutput?.(line, sourceLine, values);
            } else if (data.type === 'complete') {
              const result = data.result as Record<string, unknown> | null;
              if (!result || typeof result !== 'object' || result.id !== request.id) return;
              finish(typeof result.error === 'string' ? result.error.slice(0, 10_000) : undefined);
            }
          });
        },
        (error: unknown) =>
          finish(
            `The Browser page could not start. ${error instanceof Error ? error.message : String(error)}`,
          ),
      );
    });
  }

  /** Removes the active page and resolves its pending run with the output already received. */
  stop() {
    this.cancel?.();
  }
}
