/// <reference lib="webworker" />
import type { RunRequest } from '@code-editor/core';
import { executeCode, type ExecutionMessage } from './execution';

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, code } = event.data;
  const result = await executeCode(id, code, (line) => {
    scope.postMessage({ type: 'output', id, line } satisfies ExecutionMessage);
  });
  scope.postMessage({ type: 'complete', result } satisfies ExecutionMessage);
};
