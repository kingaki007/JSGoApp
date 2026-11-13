/** Locates where a snippet's error was thrown by reading the engine's stack for the snippet's frames. */

export interface ErrorFrame {
  /** Function name, or an empty string for top-level code. */
  name: string;
  /** 1-based line of the executed code. */
  line: number;
}

export interface ErrorTrace {
  /** Line where the error originated; 0 when it cannot be determined. */
  line: number;
  /** Snippet frames from innermost to outermost; engine and host frames are left out. */
  frames: ErrorFrame[];
}

const maxFrames = 10;
// Names engines give to code that has no function of its own.
const anonymousNames = new Set(['', 'eval', 'anonymous', 'Object.eval', 'async', '<anonymous>']);

/**
 * Extracts the frames that belong to one named script from an engine stack.
 * Understands V8 (`at name (file:line:column)`) and Gecko/WebKit (`name@file:line:column`) forms.
 * @param stack Raw `error.stack` text.
 * @param sourceName Script name given to the snippet through a `sourceURL` comment.
 * @returns Frames with the engine's own line numbers, innermost first.
 */
export function parseStack(stack: string, sourceName: string): ErrorFrame[] {
  const location = new RegExp(`${sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+):\\d+`);
  const frames: ErrorFrame[] = [];
  for (const text of stack.split('\n')) {
    const match = location.exec(text);
    if (!match) continue;
    const before = text.slice(0, match.index);
    const name = before.includes('@')
      ? before.slice(0, before.lastIndexOf('@')).trim()
      : before
          .replace(/^\s*at\s+/, '')
          .replace(/^async\s+/, '')
          .replace(/\s*\(.*$/, '')
          .trim();
    frames.push({ name: anonymousNames.has(name) ? '' : name, line: Number(match[1]) });
  }
  return frames;
}

let measuredOrigin: number | undefined;

/**
 * Measures which stack line this engine reports for the first line of a generated function body.
 * Engines count the generated function's header differently, so the offset is measured, not assumed.
 * @returns That line number, or 0 when the engine's stack cannot be read.
 */
export function bodyOrigin(): number {
  if (measuredOrigin !== undefined) return measuredOrigin;
  measuredOrigin = 0;
  try {
    // Same shape as the snippet function: two parameters and a body that starts on its own line.
    new Function('a', 'b', 'throw new Error("probe");\n//# sourceURL=jsgoapp-origin.js')();
  } catch (error) {
    const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack : '';
    measuredOrigin = parseStack(stack, 'jsgoapp-origin.js')[0]?.line ?? 0;
  }
  return measuredOrigin;
}

/**
 * Finds where a caught value was thrown within the snippet.
 * @param error Anything thrown by the snippet or by parsing it.
 * @param sourceName Script name given to the snippet through a `sourceURL` comment.
 * @param prefixLines Lines the host places before the snippet inside the function body.
 * @param mapLine Translates a body line to a line of the executed code, when the host compiled it.
 */
export function traceError(
  error: unknown,
  sourceName: string,
  prefixLines = 0,
  mapLine: (line: number) => number = (line) => line,
): ErrorTrace {
  if (!error || typeof error !== 'object') return { line: 0, frames: [] };
  // Syntax errors come from the parser, which reports the position directly.
  const parsed = (error as { loc?: { line?: unknown } }).loc?.line;
  if (typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0)
    return { line: parsed, frames: [] };
  const stack = (error as { stack?: unknown }).stack;
  const origin = bodyOrigin();
  if (typeof stack !== 'string' || origin === 0) return { line: 0, frames: [] };
  const frames = parseStack(stack, sourceName)
    .map((frame) => ({ name: frame.name, line: mapLine(frame.line - origin + 1 - prefixLines) }))
    .filter((frame) => Number.isInteger(frame.line) && frame.line > 0)
    .slice(0, maxFrames);
  return { line: frames[0]?.line ?? 0, frames };
}

/**
 * Validates frames received from another process before they reach the UI.
 * @param input Untrusted message field.
 * @returns Sanitized frames; malformed input yields an empty list.
 */
export function readErrorFrames(input: unknown): ErrorFrame[] {
  if (!Array.isArray(input)) return [];
  const frames: ErrorFrame[] = [];
  for (const item of input.slice(0, maxFrames)) {
    const frame = item as { name?: unknown; line?: unknown } | null;
    if (
      !frame ||
      typeof frame !== 'object' ||
      typeof frame.name !== 'string' ||
      typeof frame.line !== 'number' ||
      !Number.isInteger(frame.line) ||
      frame.line < 1 ||
      frame.line > 1_000_000
    )
      return [];
    frames.push({ name: frame.name.slice(0, 200), line: frame.line });
  }
  return frames;
}
