import type { RunRequest, RunResult, RuntimeAdapter } from '@code-editor/core';

// A worker keeps CPU-bound snippets off the UI thread. No DOM preview yet.
export class BrowserRuntime implements RuntimeAdapter {
  private worker?: Worker;
  private cancel?: () => void;

  run(request: RunRequest): Promise<RunResult> {
    this.stop();
    return new Promise(resolve => {
      const worker = new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      const finish = (result: RunResult) => {
        clearTimeout(timer);
        worker.terminate();
        if (this.worker === worker) { this.worker = undefined; this.cancel = undefined; }
        resolve(result);
      };
      const timer = setTimeout(() => finish({ id: request.id, lines: [], error: 'Execution exceeded 5 seconds.' }), 5000);
      this.cancel = () => finish({ id: request.id, lines: [], error: 'Execution stopped.' });
      worker.onmessage = event => finish(event.data as RunResult);
      worker.onerror = event => finish({ id: request.id, lines: [], error: event.message });
      worker.postMessage(request);
    });
  }

  stop() { this.cancel?.(); }
}
