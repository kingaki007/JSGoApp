import type { RunResult } from '@code-editor/core';

export type ExecutionMessage =
  { type: 'output'; id: string; line: string } | { type: 'complete'; result: RunResult };

function format(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  const seen = new WeakSet<object>();
  return (
    JSON.stringify(value, (_key, item: unknown) => {
      if (typeof item === 'bigint') return `${item}n`;
      if (item && typeof item === 'object') {
        if (seen.has(item)) return '[Circular]';
        seen.add(item);
      }
      return item;
    }) ?? String(value)
  );
}

// Used only inside the disposable execution worker, not in the app UI.
export async function executeCode(
  id: string,
  code: string,
  onOutput: (line: string) => void,
): Promise<RunResult> {
  const lines: string[] = [];
  let size = 0;
  let truncated = false;
  const log = (...values: unknown[]) => {
    if (truncated) return;
    if (lines.length >= 499 || size >= 90_000) {
      const notice = '[Output limit reached. Further logs omitted.]';
      lines.push(notice);
      onOutput(notice);
      truncated = true;
      return;
    }
    const line = values
      .map(format)
      .join(' ')
      .slice(0, Math.min(10_000, 90_000 - size));
    size += line.length;
    lines.push(line);
    onOutput(line);
  };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction(
      'console',
      `"use strict";\n${code}\n//# sourceURL=jsgoapp-scratchpad.js`,
    )({
      log,
      info: log,
      warn: log,
      error: log,
      debug: log,
      table: log,
    });
    return { id, lines };
  } catch (error) {
    return { id, lines, error: error instanceof Error ? error.message : String(error) };
  }
}
