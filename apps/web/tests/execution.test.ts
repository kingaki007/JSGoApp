/** Verifies console capture, awaited execution, error reporting, and output flood limits. */
import { describe, expect, it, vi } from 'vitest';
import { executeCode, watchFailures } from '../src/execution';

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
    expect(output.mock.calls).toEqual(result.lines.map((line) => [line, 1, null, 'log']));
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
      details: [null, null],
      levels: ['log', 'log'],
    });
    expect(output.mock.calls).toEqual([
      ['before', 1, null, 'log'],
      ['{"answer":42}', 1, null, 'log'],
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
    const shown = await executeCode('shown', code, () => {}, { showUndefined: true });
    expect(shown.lines).toEqual(['logged', 'undefined', 'undefined']);
    expect(shown.sourceLines).toEqual([1, 2, 4]);
  });

  it('sends expandable trees for objects only when inspection is requested', async () => {
    const code = 'console.log("user", { name: "Ada" });\n[1, 2];\n"text";';
    const plain = await executeCode('plain', code, () => {});
    expect(plain.details).toEqual([null, null, null]);
    const output = vi.fn();
    const inspected = await executeCode('inspected', code, output, { inspect: true });
    expect(inspected.lines).toEqual(['user {"name":"Ada"}', '[1,2]', 'text']);
    expect(inspected.details?.[0]).toEqual([
      { type: 'string', text: 'user' },
      {
        type: 'object',
        text: 'Object',
        entries: [{ key: 'name', value: { type: 'string', text: 'Ada' } }],
      },
    ]);
    expect(inspected.details?.[1]?.[0]).toMatchObject({ type: 'array', text: 'Array(2)' });
    expect(inspected.details?.[2]).toBeNull();
    expect(output.mock.calls[0][2]).toEqual(inspected.details?.[0]);
  });

  it('stops a runaway loop from inside when given a time limit', async () => {
    const result = await executeCode('loop', 'console.log("started"); while (true) {}', () => {}, {
      timeoutMs: 50,
    });
    expect(result.lines).toEqual(['started']);
    expect(result.error).toBe('Execution exceeded 0 seconds.');
  });

  it('records the level of each console method and supports the wider console API', async () => {
    const output = vi.fn();
    const result = await executeCode(
      'levels',
      'console.info("i");\nconsole.warn("w");\nconsole.error("e");\nconsole.debug("d");\nconsole.assert(1 === 2, "math");\nconsole.count("n");\nconsole.dir({ a: 1 });\nconsole.group("g"); console.groupEnd();\n2 + 2;',
      output,
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toEqual([
      'i',
      'w',
      'e',
      'd',
      'Assertion failed: math',
      'n: 1',
      '{"a":1}',
      'g',
      '4',
    ]);
    expect(result.levels).toEqual([
      'info',
      'warn',
      'error',
      'debug',
      'error',
      'log',
      'log',
      'log',
      'log',
    ]);
    expect(result.sourceLines).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(output.mock.calls[1]).toEqual(['w', 2, null, 'warn']);
  });

  it('reports where an error originated, with the snippet frames', async () => {
    const result = await executeCode(
      'located',
      [
        'function parse(text) {',
        '  return JSON.parse(text);',
        '}',
        'console.log("start");',
        'parse("{oops");',
      ].join(String.fromCharCode(10)),
      () => {},
    );
    expect(result.lines).toEqual(['start']);
    expect(result.error).toBeTruthy();
    expect(result.errorLine).toBe(2);
    expect(result.errorFrames).toEqual([
      { name: 'parse', line: 2 },
      { name: '', line: 5 },
    ]);
  });

  it('locates syntax errors and gives no location for thrown values without a stack', async () => {
    const syntax = await executeCode(
      'syntax',
      ['const a = 1;', 'const = ;'].join(String.fromCharCode(10)),
      () => {},
    );
    expect(syntax.errorLine).toBe(2);
    expect(syntax.errorFrames).toEqual([]);
    const text = await executeCode('text', 'throw "plain text";', () => {});
    expect(text.error).toBe('plain text');
    expect(text.errorLine).toBeUndefined();
  });

  it('fails the run when a promise is rejected without being handled while the code is running', async () => {
    const page = new EventTarget();
    const reason = new Error('rejected in the background');
    setTimeout(() => {
      page.dispatchEvent(
        Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason }),
      );
    }, 10);
    const result = await executeCode(
      'background',
      'console.log("started"); await new Promise((resolve) => setTimeout(resolve, 200)); console.log("not reached");',
      () => {},
      { failures: watchFailures(page) },
    );
    expect(result.lines).toEqual(['started']);
    expect(result.error).toBe('rejected in the background');
  });

  it('fails the run for a rejection or timer error reported just after the code returns', async () => {
    const page = new EventTarget();
    // Arrives shortly after the code returns, as browsers report trailing rejections.
    setTimeout(() => {
      page.dispatchEvent(
        Object.assign(new Event('error', { cancelable: true }), {
          error: new Error('thrown in a timer'),
        }),
      );
    }, 10);
    const result = await executeCode('trailing', '1 + 1;', () => {}, {
      failures: watchFailures(page),
    });
    expect(result.lines).toEqual(['2']);
    expect(result.error).toBe('thrown in a timer');
  });

  it('stops listening when the run ends and leaves successful runs unaffected', async () => {
    const page = new EventTarget();
    const remove = vi.spyOn(page, 'removeEventListener');
    const result = await executeCode('fine', '1 + 1;', () => {}, { failures: watchFailures(page) });
    expect(result.error).toBeUndefined();
    expect(remove).toHaveBeenCalledTimes(2);
    // A failure after the run is over is not reported and does not raise a new unhandled rejection.
    page.dispatchEvent(
      Object.assign(new Event('unhandledrejection'), { reason: new Error('late') }),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
  });

  it('describes error events that carry only a message', async () => {
    const page = new EventTarget();
    const watch = watchFailures(page);
    page.dispatchEvent(
      Object.assign(new Event('error', { cancelable: true }), { message: 'Script error.' }),
    );
    await expect(watch.failed).rejects.toThrow('Script error.');
    watch.stop();
  });

  it('sends console.table data as a table, with a text form, and logs non-tabular data normally', async () => {
    const result = await executeCode(
      'table',
      'console.table([{ name: "Ada", age: 36 }, { name: "Linus", age: 54 }]); console.table("just text");',
      () => {},
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toEqual([
      '(index) | name | age' +
        String.fromCharCode(10) +
        '0 | Ada | 36' +
        String.fromCharCode(10) +
        '1 | Linus | 54',
      'just text',
    ]);
    expect(result.details?.[0]).toEqual([
      {
        type: 'table',
        text: 'Table(2)',
        table: {
          columns: ['(index)', 'name', 'age'],
          rows: [
            ['0', 'Ada', '36'],
            ['1', 'Linus', '54'],
          ],
        },
      },
    ]);
    expect(result.details?.[1]).toBeNull();
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
