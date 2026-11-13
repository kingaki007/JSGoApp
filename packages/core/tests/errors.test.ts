/** Verifies stack parsing across engine formats, real thrown-error tracing, and frame validation. */
import { describe, expect, it } from 'vitest';
import { bodyOrigin, parseStack, readErrorFrames, traceError } from '../src/errors';

/**
 * Runs code the way the runtimes do and returns the trace of whatever it throws.
 * @param code Snippet placed after one preamble line inside a generated function.
 */
function traceOf(code: string) {
  try {
    new Function('a', 'b', `"use strict";\n${code}\n//# sourceURL=snippet.js`)();
  } catch (error) {
    return traceError(error, 'snippet.js', 1);
  }
  throw new Error('The snippet did not throw.');
}

describe('error tracing', () => {
  it('reads V8 frames, including async and anonymous ones, and ignores other scripts', () => {
    const stack = [
      'Error: boom',
      '    at inner (snippet.js:7:9)',
      '    at async outer (snippet.js:12:3)',
      '    at eval (snippet.js:15:1)',
      '    at executeCode (http://localhost/assets/runner.js:1:2345)',
      '    at snippet.js:20:5',
    ].join('\n');
    expect(parseStack(stack, 'snippet.js')).toEqual([
      { name: 'inner', line: 7 },
      { name: 'outer', line: 12 },
      { name: '', line: 15 },
      { name: '', line: 20 },
    ]);
  });

  it('reads Gecko and WebKit frames', () => {
    const stack = ['inner@snippet.js:7:9', 'outer@snippet.js:12:3', '@snippet.js:15:1'].join('\n');
    expect(parseStack(stack, 'snippet.js')).toEqual([
      { name: 'inner', line: 7 },
      { name: 'outer', line: 12 },
      { name: '', line: 15 },
    ]);
  });

  it('measures the engine offset and locates a top-level throw', () => {
    expect(bodyOrigin()).toBeGreaterThan(0);
    expect(traceOf('const value = 1;\n\nthrow new Error("third line");')).toEqual({
      line: 3,
      frames: [{ name: '', line: 3 }],
    });
  });

  it('reports the innermost snippet frame first for errors thrown inside functions', () => {
    const trace = traceOf(
      'function inner() {\n  null.missing;\n}\nfunction outer() {\n  inner();\n}\nouter();',
    );
    expect(trace.line).toBe(2);
    expect(trace.frames).toEqual([
      { name: 'inner', line: 2 },
      { name: 'outer', line: 5 },
      { name: '', line: 7 },
    ]);
  });

  it('uses the parser position for syntax errors and maps lines when the host compiled the code', () => {
    expect(
      traceError(Object.assign(new SyntaxError('bad'), { loc: { line: 4, column: 2 } }), 'x'),
    ).toEqual({ line: 4, frames: [] });
    try {
      new Function(
        'a',
        'b',
        '"use strict";\nthrow new Error("mapped");\n//# sourceURL=mapped.js',
      )();
    } catch (error) {
      expect(traceError(error, 'mapped.js', 1, (line) => line + 10).line).toBe(11);
      // A line the map cannot place is dropped rather than reported wrongly.
      expect(traceError(error, 'mapped.js', 1, () => 0)).toEqual({ line: 0, frames: [] });
    }
  });

  it('gives no location for thrown values without a stack', () => {
    expect(traceError('just a string', 'snippet.js')).toEqual({ line: 0, frames: [] });
    expect(traceError(null, 'snippet.js')).toEqual({ line: 0, frames: [] });
    expect(traceError({ message: 'plain object' }, 'snippet.js')).toEqual({ line: 0, frames: [] });
  });

  it('accepts well-formed untrusted frames and rejects malformed ones', () => {
    expect(readErrorFrames([{ name: 'run', line: 3, extra: true }])).toEqual([
      { name: 'run', line: 3 },
    ]);
    expect(readErrorFrames(undefined)).toEqual([]);
    expect(readErrorFrames([{ name: 'run', line: 0 }])).toEqual([]);
    expect(readErrorFrames([{ name: 5, line: 3 }])).toEqual([]);
    expect(readErrorFrames([{ name: 'run', line: 2.5 }])).toEqual([]);
    expect(
      readErrorFrames(Array.from({ length: 30 }, () => ({ name: 'f', line: 1 }))),
    ).toHaveLength(10);
  });
});
