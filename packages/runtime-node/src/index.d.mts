/** Types the shared execution lifecycle and the small process bridge supplied by each host. */
import type { RunRequest, RunResult } from '@code-editor/core';

export interface RunnerProcess {
  /** @param request Validated execution request sent after listeners are installed. */
  send(request: RunRequest): void;
  /** Terminates the active snippet process. */
  kill(): void;
  /** @param listener Receives structured output from the child. */
  onMessage(listener: (message: unknown) => void): void;
  /** @param listener Receives process termination, including crashes. */
  onExit(listener: () => void): void;
  /** @param listener Receives launch or process errors. */
  onError(listener: (error: Error) => void): void;
}
export const runnerPath: string;
/** Returns the minimal OS environment passed to snippet processes. */
export function runnerEnvironment(): Record<string, string>;
/** @param value Untrusted request received over HTTP or IPC. */
export function validRequest(value: unknown): value is RunRequest;
/** @param options Optional host-specific process factory and execution deadline. */
export class NodeRuntime {
  constructor(options?: { launch?: () => RunnerProcess; timeoutMs?: number });
  /** @param request Compiled source. @param onOutput Receives bounded console text. */
  run(request: RunRequest, onOutput?: (line: string) => void): Promise<RunResult>;
  /** Terminates the current snippet and resolves its pending execution. */
  stop(): void;
}
