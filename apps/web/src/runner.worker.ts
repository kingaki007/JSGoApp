/** Receives a run request in a dedicated worker and posts streamed lines and the final result. */
/// <reference lib="webworker" />
import type { RunRequest } from '@code-editor/core';
import { executeCode, type ExecutionMessage } from './execution';

const scope = self as unknown as DedicatedWorkerGlobalScope;
/** @param event Message containing a unique run ID and compiled JavaScript to execute. */
scope.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, code } = event.data;
  const result = await executeCode(id, code, (line) => {
    scope.postMessage({ type: 'output', id, line } satisfies ExecutionMessage);
  });
  scope.postMessage({ type: 'complete', result } satisfies ExecutionMessage);
};
