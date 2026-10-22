/** Connects Node execution to either the narrow Electron bridge or the local web execution service. */
import type { RunRequest, RunResult, RuntimeAdapter } from '@code-editor/core';

/** Owns one Node transport and cancels its process when execution is stopped or replaced. */
export class NodeRuntime implements RuntimeAdapter {
  private controller?: AbortController;
  private unsubscribe?: () => void;
  /** @param request Compiled Node source. @param onOutput Receives streamed console text. */
  async run(request: RunRequest, onOutput?: (line: string) => void): Promise<RunResult> {
    this.stop();
    if (request.environment !== 'node') throw new Error('Expected the Node.js environment.');
    const controller = new AbortController();
    this.controller = controller;
    if (window.desktop) {
      const unsubscribe = window.desktop.onOutput((message) => {
        if (!controller.signal.aborted && message.id === request.id) onOutput?.(message.line);
      });
      this.unsubscribe = unsubscribe;
      try {
        return await window.desktop.run(request);
      } finally {
        unsubscribe();
        if (this.unsubscribe === unsubscribe) this.unsubscribe = undefined;
      }
    }
    try {
      const response = await fetch('/__runner/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-JSGoApp-Runner': '1' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok || !response.body)
        throw new Error(`Node runner returned HTTP ${response.status}.`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const lines: string[] = [];
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        if (buffer.length > 150_000) throw new Error('Invalid Node runner response.');
        let boundary;
        while ((boundary = buffer.indexOf('\n')) >= 0) {
          const message = JSON.parse(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 1);
          if (
            message.type === 'output' &&
            message.id === request.id &&
            typeof message.line === 'string' &&
            lines.length < 500
          ) {
            const line = message.line.slice(0, 10_000);
            lines.push(line);
            onOutput?.(line);
          } else if (message.type === 'complete' && message.result?.id === request.id) {
            return {
              id: request.id,
              lines,
              ...(typeof message.result.error === 'string'
                ? { error: message.result.error.slice(0, 10_000) }
                : {}),
            };
          }
        }
      }
      throw new Error('Node runner disconnected before completion.');
    } catch (error) {
      if (controller.signal.aborted)
        return { id: request.id, lines: [], error: 'Execution stopped.' };
      throw new Error(
        `Node.js is unavailable. Start pnpm dev:runner for web execution. ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      controller.abort();
      if (this.controller === controller) this.controller = undefined;
    }
  }
  /** Cancels IPC execution or HTTP streaming, which also cancels the server-side process. */
  stop() {
    this.controller?.abort();
    this.controller = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    if (window.desktop) void window.desktop.stop().catch(() => {});
  }
}
