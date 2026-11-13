/** Checks expression instrumentation preserves scope, side effects, directives, and nested execution. */
import { describe, expect, it } from 'vitest';
import { captureExpressions } from '../src/expressions';
import { createCapture } from '../src/index';

/** @param source JavaScript snippet to evaluate with a recording result callback. */
async function evaluate(source: string) {
  const { code, captureName } = captureExpressions(source);
  const values: unknown[] = [];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  /** @param value Expression result recorded unless undefined, then returned unchanged. */
  const capture = (value: unknown) => {
    if (value !== undefined) values.push(value);
    return value;
  };
  await new AsyncFunction(captureName, `"use strict";\n${code}`)(
    Object.assign(capture, { tick() {}, at: () => console }),
  );
  return values;
}

describe('automatic expression results', () => {
  it('captures arithmetic, arrays, objects, strings, false and null', async () => {
    expect(
      await evaluate('2 + 2; [1, 2].map(n => n * 2); ({ answer: 42 }); "hello"; false; null;'),
    ).toEqual([4, [2, 4], { answer: 42 }, 'hello', false, null]);
  });

  it('evaluates side effects once and leaves nested function bodies unchanged', async () => {
    expect(
      await evaluate('let count = 0; function next() { count++; return count; } next(); count;'),
    ).toEqual([1, 1]);
  });

  it('preserves method receivers, directive statements, and semicolon-free expressions', async () => {
    expect(
      await evaluate(
        '"use strict";\nconst obj = { value: 3, read() { return this.value; } };\nobj.read()\nobj.value + 1',
      ),
    ).toEqual([3, 4]);
  });

  it('avoids helper collisions, including escaped identifiers and closure references', async () => {
    expect(
      await evaluate(
        'const \\u005f_jsgoappCapture = 7; function read() { return __jsgoappCapture; } read();',
      ),
    ).toEqual([7]);
  });

  it('captures explicitly awaited values without awaiting every promise automatically', async () => {
    expect(await evaluate('await Promise.resolve(12); undefined;')).toEqual([12]);
  });

  it('passes each expression its first source line and tags console calls with theirs', () => {
    const { code, captureName } = captureExpressions(
      'const total = 1;\ntotal +\n  1;\nfunction log() {\n  console.log(total);\n}\nconsole.warn("direct");',
    );
    expect(code).toContain(`${captureName}((total +\n  1), 2);`);
    expect(code).toContain(`${captureName}.at(5).log(total);`);
    // A console statement reports its own output and is not wrapped as an expression result.
    expect(code).toContain(`\n${captureName}.at(7).warn("direct");`);
  });

  it('keeps wrapper and console edits ordered when an expression starts with a console call', async () => {
    const { code, captureName } = captureExpressions('console.log("a"), 5;');
    expect(code).toBe(`${captureName}((${captureName}.at(1).log("a"), 5), 1);`);
    // The comma expression reports its last value, not its first.
    expect(await evaluate('1, 2, 3;')).toEqual([3]);
  });

  it('adds a tick to every loop body without changing results, including brace-less bodies', async () => {
    const source =
      'let total = 0;\nfor (let i = 0; i < 3; i++) total += i;\nwhile (total < 10) { total++; }\ndo total++; while (total < 12);\nfor (const item of [1, 2]) total += item;\nfor (const key in { a: 1 }) total += key.length;\ntotal;';
    const { code, captureName } = captureExpressions(source);
    expect(code.split(`${captureName}.tick();`)).toHaveLength(6);
    expect(code).toContain(`for (let i = 0; i < 3; i++) {${captureName}.tick();total += i;}`);
    expect(await evaluate(source)).toEqual([16]);
  });

  it('guards loops nested inside functions and labelled loops', () => {
    const { code, captureName } = captureExpressions(
      'function spin() { outer: for (;;) { while (true) break outer; } }',
    );
    expect(code.split(`${captureName}.tick();`)).toHaveLength(3);
    expect(() => new Function(captureName, code)).not.toThrow();
  });

  it('stops a runaway loop from inside once the deadline passes', () => {
    const capture = createCapture(
      console,
      () => {},
      () => {},
      false,
      0,
    );
    const { code, captureName } = captureExpressions('while (true) {}');
    const started = Date.now();
    expect(() => new Function(captureName, code)(capture)).toThrow('Execution exceeded 0 seconds.');
    expect(Date.now() - started).toBeLessThan(2000);
    // Without a limit the tick never throws, so hosts that end the process themselves are unaffected.
    const unlimited = createCapture(
      console,
      () => {},
      () => {},
    );
    for (let index = 0; index < 5000; index++) unlimited.tick();
  });

  it('keeps imports intact for the Node compilation stage and rejects invalid syntax', () => {
    expect(captureExpressions('import path from "node:path"; path.sep;').code).toContain(
      'import path from "node:path";',
    );
    expect(() => captureExpressions('const = ;')).toThrow();
  });
});
