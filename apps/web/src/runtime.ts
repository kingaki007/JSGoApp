/** Implements the browser execution lifecycle with disposable workers, streamed logs, and time limits. */
import {
  normalizeSourceLine,
  type OutputListener,
  type RunRequest,
  type RunResult,
  type RuntimeAdapter,
} from '@code-editor/core';
import { readInspectedValues, type InspectedValue } from '@code-editor/core/inspect';
import type { ExecutionMessage } from './execution';

/** Keeps CPU-bound snippets off the UI thread; this adapter does not provide DOM or Node APIs. */
export class BrowserRuntime implements RuntimeAdapter {
  private worker?: Worker;
  private cancel?: () => void;

  /**
   * Replaces any previous execution and resolves when the new run completes, fails, or is stopped.
   * @param request Unique run ID, executable JavaScript, and target environment.
   * @param onOutput Optional callback receiving each captured line and its code line as it arrives.
   */
  run(request: RunRequest, onOutput?: OutputListener): Promise<RunResult> {
    this.stop();
    if (request.environment !== 'browser') {
      return Promise.reject(new Error('Node execution is not connected yet.'));
    }
    return new Promise((resolve) => {
      const lines: string[] = [];
      const sourceLines: number[] = [];
      const details: Array<InspectedValue[] | null> = [];
      let finished = false;
      const worker = new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      /** @param result Final output or failure to resolve after the worker and timer are cleaned up. */
      const finish = (result: RunResult) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        worker.terminate();
        if (this.worker === worker) {
          this.worker = undefined;
          this.cancel = undefined;
        }
        resolve(result);
      };
      const timer = setTimeout(
        () =>
          finish({
            id: request.id,
            lines: [...lines],
            sourceLines: [...sourceLines],
            details: [...details],
            error: 'Execution exceeded 5 seconds.',
          }),
        5000,
      );
      this.cancel = () =>
        finish({
          id: request.id,
          lines: [...lines],
          sourceLines: [...sourceLines],
          details: [...details],
          error: 'Execution stopped.',
        });
      worker.onmessage = (event: MessageEvent<ExecutionMessage>) => {
        if (finished) return;
        const message = event.data;
        if (message.type === 'output' && message.id === request.id) {
          if (lines.length >= 500) return;
          const sourceLine = normalizeSourceLine(message.sourceLine);
          lines.push(message.line);
          const values = readInspectedValues(message.values);
          sourceLines.push(sourceLine);
          details.push(values);
          onOutput?.(message.line, sourceLine, values);
        } else if (message.type === 'complete' && message.result.id === request.id) {
          finish(message.result);
        }
      };
      worker.onerror = (event) =>
        finish({
          id: request.id,
          lines: [...lines],
          sourceLines: [...sourceLines],
          details: [...details],
          error: event.message,
        });
      worker.postMessage(request);
    });
  }

  /** Terminates the active worker and resolves its pending run with the output already received. */
  stop() {
    this.cancel?.();
  }
}
