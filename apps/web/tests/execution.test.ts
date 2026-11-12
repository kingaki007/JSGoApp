/** Verifies console capture, awaited execution, error reporting, and output flood limits. */
import { describe, expect, it, vi } from 'vitest';
import { executeCode } from '../src/execution';

describe('scratchpad execution', () => {
  it('streams expression results alongside logs, without duplicate output or repeated side effects', async () => {
    const output = vi.fn();
    const result = await executeCode(
      'expressions',
      'let count = 0; ++count; console.log("logged"); count; await Promise.resolve(42);',
      output,
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toEqual(['1', 'logged', '1', '42']);
    expect(result.sourceLines).toEqual([1, 1, 1, 1]);
    expect(output.mock.calls).toEqual(result.lines.map((line) => [line, 1]));
  });
  it('streams logs and waits for explicitly awaited work', async () => {
    const output = vi.fn();
    const result = await executeCode(
      'run',
      'console.log("before"); await Promise.resolve(); console.log({ answer: 42 });',
      output,
    );
    expect(result).toEqual({
      id: 'run',
      lines: ['before', '{"answer":42}'],
      sourceLines: [1, 1],
    });
    expect(output.mock.calls).toEqual([
      ['before', 1],
      ['{"answer":42}', 1],
    ]);
  });

  it('reports the source line of expressions and of console calls made inside functions', async () => {
    const result = await executeCode(
      'lines',
      'function greet() {\n  console.log("inside");\n}\n1 + 1;\ngreet();\n\n[1, 2]\n  .length;',
      () => {},
    );
    expect(result.lines).toEqual(['2', 'inside', '2']);
    expect(result.sourceLines).toEqual([4, 2, 7]);
  });

  it('reports undefined expression results only on request, never for console calls', async () => {
    const code = 'console.log("logged");\nvoid 0;\nlet value;\nvalue;';
    expect((await executeCode('quiet', code, () => {})).lines).toEqual(['logged']);
    const shown = await executeCode('shown', code, () => {}, true);
    expect(shown.lines).toEqual(['logged', 'undefined', 'undefined']);
    expect(shown.sourceLines).toEqual([1, 2, 4]);
  });

  it('keeps earlier output when execution throws', async () => {
    const result = await executeCode(
      'error',
      'console.log("started"); throw new Error("Something broke");',
      () => {},
    );
    expect(result.lines).toEqual(['started']);
    expect(result.error).toBe('Something broke');
  });

  it('reports malformed JavaScript without running it', async () => {
    const result = await executeCode('syntax', 'console.log("not reached"); const = ;', () => {});
    expect(result.lines).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it('bounds output and tells the user when logs are omitted', async () => {
    const result = await executeCode(
      'flood',
      'for (let i = 0; i < 1000; i++) console.log(i);',
      () => {},
    );
    expect(result.lines.length).toBeLessThanOrEqual(500);
    expect(result.lines.at(-1)).toContain('Output limit reached');
  });
});
