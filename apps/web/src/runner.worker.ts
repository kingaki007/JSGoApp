/// <reference lib="webworker" />
import type { RunRequest, RunResult } from '@code-editor/core';

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, code } = event.data;
  const lines: string[] = [];
  let size = 0;
  const format = (value: unknown): string => {
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
  };
  const log = (...values: unknown[]) => {
    if (lines.length >= 500 || size >= 100_000) return;
    const line = values.map(format).join(' ').slice(0, 10_000);
    size += line.length;
    lines.push(line);
  };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction('console', code)({ log, info: log, warn: log, error: log, debug: log, table: log });
    scope.postMessage({ id, lines } satisfies RunResult);
  } catch (error) {
    scope.postMessage({ id, lines, error: error instanceof Error ? error.message : String(error) } satisfies RunResult);
  }
};
