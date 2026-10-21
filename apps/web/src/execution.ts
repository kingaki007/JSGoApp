/** Executes compiled JavaScript inside a worker and formats bounded console output for the host. */
import type { RunResult } from '@code-editor/core';

export type ExecutionMessage =
  { type: 'output'; id: string; line: string } | { type: 'complete'; result: RunResult };

/**
 * Produces display text without failing on bigint values or circular object references.
 * @param value One console argument to represent as plain text.
 */
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

/**
 * Evaluates JavaScript and awaits explicitly awaited asynchronous work inside a disposable worker.
 * @param id Run identifier echoed in the final result.
 * @param code JavaScript source; TypeScript must already have been compiled by the editor.
 * @param onOutput Receives each formatted console line, including the output-limit notice.
 */
export async function executeCode(
  id: string,
  code: string,
  onOutput: (line: string) => void,
): Promise<RunResult> {
  const lines: string[] = [];
  let size = 0;
  let truncated = false;
  /** @param values Console arguments captured subject to line-count and text-size limits. */
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
