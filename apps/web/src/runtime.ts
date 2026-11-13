/** Implements the Browser execution lifecycle with one disposable sandboxed page per run. */
import {
  normalizeSourceLine,
  type OutputListener,
  type RunRequest,
  type RunResult,
  type RuntimeAdapter,
} from '@code-editor/core';
import { readLevel, type ConsoleLevel } from '@code-editor/core/console';
import { readErrorFrames, type ErrorFrame } from '@code-editor/core/errors';
import { readInspectedValues, type InspectedValue } from '@code-editor/core/inspect';
import { createFrameHost, type FrameHost } from './frameHost';

export const browserTimeoutMs = 5000;
// The page stops runaway loops itself; this extra time lets that clearer error arrive first.
const hostGraceMs = 500;

/**
 * Runs snippets in a page with a real document and window. The page shares the app's thread, so a
 * loop is stopped from inside the page; the host timer covers work that never finishes.
 * With a Web view mount the page is shown there and kept after the run, so what it rendered stays
 * visible and its listeners and animations keep working until the next run or Stop.
 */
export class BrowserRuntime implements RuntimeAdapter {
  private cancel?: () => void;
  private mount: HTMLElement | null = null;
  /** Page kept after a finished run while the Web view shows it. */
  private page?: FrameHost;
  private readonly createHost: (mount: HTMLElement | null) => Promise<FrameHost>;
  private readonly timeoutMs: number;

  /** @param options Page factory and time limit, replaceable in tests. */
  constructor({
    createHost = createFrameHost,
    timeoutMs = browserTimeoutMs,
  }: {
    createHost?: (mount: HTMLElement | null) => Promise<FrameHost>;
    timeoutMs?: number;
  } = {}) {
    this.createHost = createHost;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Chooses where the next page appears. Changing it ends the active run and removes the current
   * page, because a page cannot move between containers without reloading.
   * @param mount Web view element, or null to run pages off screen.
   */
  setMount(mount: HTMLElement | null) {
    if (this.mount === mount) return;
    this.stop();
    this.mount = mount;
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
      const levels: ConsoleLevel[] = [];
      let finished = false;
      let host: FrameHost | undefined;
      const mount = this.mount;
      const seconds = Math.round(this.timeoutMs / 1000);
      /**
       * @param error Optional failure reported to the user.
       * @param keepPage Whether the page stays for the Web view; runs ended by the host never keep it.
       * @param location Where the snippet's own error originated, when the page could tell.
       */
      const finish = (
        error?: string,
        keepPage = false,
        location?: { line: number; frames: ErrorFrame[] },
      ) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        if (keepPage && host && mount && this.mount === mount) this.page = host;
        else host?.dispose();
        if (this.cancel === cancel) this.cancel = undefined;
        resolve({
          id: request.id,
          lines,
          sourceLines,
          details,
          levels,
          ...(error ? { error } : {}),
          ...(error && location?.line
            ? { errorLine: location.line, errorFrames: location.frames }
            : {}),
        });
      };
      /** Ends the run on Stop or replacement while keeping output already received. */
      const cancel = () => finish('Execution stopped.');
      const timer = setTimeout(
        () => finish(`Execution exceeded ${seconds} seconds.`),
        this.timeoutMs + hostGraceMs,
      );
      this.cancel = cancel;
      this.createHost(mount).then(
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
              const level = readLevel(data.level);
              details.push(values);
              levels.push(level);
              onOutput?.(line, sourceLine, values, level);
            } else if (data.type === 'complete') {
              const result = data.result as Record<string, unknown> | null;
              if (!result || typeof result !== 'object' || result.id !== request.id) return;
              finish(
                typeof result.error === 'string' ? result.error.slice(0, 10_000) : undefined,
                true,
                {
                  line: normalizeSourceLine(result.errorLine),
                  frames: readErrorFrames(result.errorFrames),
                },
              );
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

  /** Ends the active run with the output already received and removes any page kept on screen. */
  stop() {
    this.cancel?.();
    this.page?.dispose();
    this.page = undefined;
  }
}
