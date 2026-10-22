/** Declares Vite asset types and the planned desktop bridge exposed to the browser-compatible UI. */
/// <reference types="vite/client" />
import type { RunRequest, RunResult } from '@code-editor/core';

declare global {
  interface Window {
    desktop?: {
      /** @param request JavaScript execution request forwarded to the desktop host. */
      run(request: RunRequest): Promise<RunResult>;
      /** Requests termination of the active desktop-hosted run. */
      stop(): Promise<void>;
      /** @param listener Receives active-run console output; returns a subscription cleanup function. */
      onOutput(listener: (message: { id: string; line: string }) => void): () => void;
    };
  }
}
