/** Checks expression instrumentation preserves scope, side effects, directives, and nested execution. */
import { describe, expect, it } from 'vitest';
import { captureExpressions } from '../src/expressions';

/** @param source JavaScript snippet to evaluate with a recording result callback. */
async function evaluate(source: string) {
  const { code, captureName } = captureExpressions(source);
  const values: unknown[] = [];
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(captureName, `"use strict";\n${code}`)((value: unknown) => {
    if (value !== undefined) values.push(value);
    return value;
  });
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
    expect(code).toContain(`${captureName}(total +\n  1, 2);`);
    expect(code).toContain(`${captureName}.at(5).log(total);`);
    // A console statement reports its own output and is not wrapped as an expression result.
    expect(code).toContain(`\n${captureName}.at(7).warn("direct");`);
  });

  it('keeps wrapper and console edits ordered when an expression starts with a console call', async () => {
    const { code, captureName } = captureExpressions('console.log("a"), 5;');
    expect(code).toBe(`${captureName}(${captureName}.at(1).log("a"), 5, 1);`);
  });

  it('keeps imports intact for the Node compilation stage and rejects invalid syntax', () => {
    expect(captureExpressions('import path from "node:path"; path.sep;').code).toContain(
      'import path from "node:path";',
    );
    expect(() => captureExpressions('const = ;')).toThrow();
  });
});
