/// <reference types="vite/client" />
import type { RunRequest, RunResult } from '@code-editor/core';

declare global {
  interface Window {
    desktop?: {
      run(request: RunRequest): Promise<RunResult>;
      stop(): Promise<void>;
    };
  }
}
