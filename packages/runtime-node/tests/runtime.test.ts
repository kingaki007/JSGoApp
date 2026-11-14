/** Exercises actual disposable Node processes, including module loading, output limits, and cancellation. */
import { describe, expect, it, vi } from 'vitest';
import { NodeRuntime, validRequest } from '@code-editor/runtime-node';

/** @param code Source for a unique Node execution request. */
function request(code: string) {
  return { id: crypto.randomUUID(), code, environment: 'node' as const };
}

describe('shared Node runner', () => {
  it('captures expressions after Node imports without logging compiler-generated statements', async () => {
    const result = await new NodeRuntime().run(
      request(
        'import path from "node:path"; let count = 0; ++count; console.log("logged"); path.basename("/tmp/example.js"); await Promise.resolve(42);',
      ),
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toEqual(['1', 'logged', 'example.js', '42']);
  });
  it('returns expandable trees for objects only when the request asks for inspection', async () => {
    const code = 'console.log({ name: "Ada", tags: new Set(["a"]) });\n42;';
    const plain = await new NodeRuntime().run(request(code));
    expect(plain.details).toEqual([null, null]);
    const output = vi.fn();
    const inspected = await new NodeRuntime().run({ ...request(code), inspect: true }, output);
    expect(inspected.error).toBeUndefined();
    expect(inspected.details?.[0]?.[0]).toMatchObject({
      type: 'object',
      entries: [
        { key: 'name', value: { type: 'string', text: 'Ada' } },
        { key: 'tags', value: { type: 'set', text: 'Set(1)' } },
      ],
    });
    expect(inspected.details?.[1]).toBeNull();
    expect(output.mock.calls[0][2]).toEqual(inspected.details?.[0]);
    expect(validRequest({ ...request(code), inspect: 'yes' })).toBe(false);
  });

  it('reports console levels and supports the wider console API', async () => {
    const output = vi.fn();
    const result = await new NodeRuntime().run(
      request(
        'console.warn("w");\nconsole.error("e");\nconsole.info("i");\nconsole.assert(false, "nope");\nconsole.count();\nconsole.dir("plain");\n1 + 1;',
      ),
      output,
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toEqual([
      'w',
      'e',
      'i',
      'Assertion failed: nope',
      'default: 1',
      'plain',
      '2',
    ]);
    expect(result.levels).toEqual(['warn', 'error', 'info', 'error', 'log', 'log', 'log']);
    expect(output.mock.calls[0]).toEqual(['w', 1, null, 'warn']);
  });

  it('reports where an error originated, including after module syntax is compiled', async () => {
    const newline = String.fromCharCode(10);
    const plain = await new NodeRuntime().run(
      request(
        [
          'function fail() {',
          '  throw new Error("inside");',
          '}',
          'console.log("start");',
          'fail();',
        ].join(newline),
      ),
    );
    expect(plain.lines).toEqual(['start']);
    expect(plain.error).toBe('inside');
    expect(plain.errorLine).toBe(2);
    expect(plain.errorFrames).toEqual([
      { name: 'fail', line: 2 },
      { name: '', line: 5 },
    ]);
    const compiled = await new NodeRuntime().run(
      request(
        [
          'import path from "node:path";',
          'import fs from "node:fs";',
          '',
          'path.sep;',
          'null.missing;',
        ].join(newline),
      ),
    );
    expect(compiled.error).toBeTruthy();
    expect(compiled.errorLine).toBe(5);
    const syntax = await new NodeRuntime().run(
      request(['const a = 1;', 'const = ;'].join(newline)),
    );
    expect(syntax.errorLine).toBe(2);
    const text = await new NodeRuntime().run(request('throw "plain text";'));
    expect(text.error).toBe('plain text');
    expect(text.errorLine).toBeUndefined();
  });

  it('fails the run for unhandled rejections and timer errors, including ones raised by the last line', async () => {
    const trailing = await new NodeRuntime().run(
      request(
        'console.log("start");' +
          String.fromCharCode(10) +
          'void Promise.reject(new Error("trailing"));',
      ),
    );
    expect(trailing.lines).toEqual(['start']);
    expect(trailing.error).toBe('trailing');
    expect(trailing.errorLine).toBe(2);
    const timer = await new NodeRuntime().run(
      request(
        'const timer = setTimeout(() => { throw new Error("in a timer"); }, 5); await new Promise((r) => setTimeout(r, 100)); console.log("not reached");',
      ),
    );
    expect(timer.lines).toEqual([]);
    expect(timer.error).toBe('in a timer');
    const handled = await new NodeRuntime().run(
      request('void Promise.reject(new Error("caught")).catch(() => console.log("handled"));'),
    );
    expect(handled.error).toBeUndefined();
    expect(handled.lines).toEqual(['handled']);
  });

  it('sends console.table data as a table without the request asking for inspection', async () => {
    const result = await new NodeRuntime().run(
      request('console.table([{ id: 1, ok: true }, { id: 2, ok: false }]); console.table(7);'),
    );
    expect(result.error).toBeUndefined();
    expect(result.details?.[0]).toEqual([
      {
        type: 'table',
        text: 'Table(2)',
        table: {
          columns: ['(index)', 'id', 'ok'],
          rows: [
            ['0', '1', 'true'],
            ['1', '2', 'false'],
          ],
        },
      },
    ]);
    expect(result.lines[1]).toBe('7');
    expect(result.details?.[1]).toBeNull();
  });

  it('does not inherit arbitrary host environment variables', async () => {
    vi.stubEnv('JSGOAPP_TEST_SECRET', 'host-only');
    try {
      const result = await new NodeRuntime().run(
        request('console.log(typeof process.env.JSGOAPP_TEST_SECRET);'),
      );
      expect(result.lines).toEqual(['undefined']);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it('runs Node built-ins and ES imports without DOM globals', async () => {
    const result = await new NodeRuntime().run(
      request(
        'import path from "node:path"; console.log(path.basename("/hello/world.js")); console.log(typeof process, typeof window, typeof Buffer);',
      ),
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toEqual(['world.js', 'object undefined function']);
  });
  it('awaits asynchronous code and retains output preceding failures', async () => {
    const result = await new NodeRuntime().run(
      request(
        'await new Promise(resolve => setTimeout(resolve, 10)); console.log("ready"); throw new Error("failure");',
      ),
    );
    expect(result.lines).toEqual(['ready']);
    expect(result.error).toBe('failure');
  });
  it('bounds output and rejects third-party package resolution', async () => {
    const result = await new NodeRuntime().run(
      request('for (let i=0; i<1000; i++) console.log("line"); require("typescript");'),
    );
    expect(result.lines).toHaveLength(500);
    expect(result.lines.at(-1)).toContain('Output limit');
    expect(result.error).toContain('Only Node built-in');
  });
  it('terminates an infinite loop while preserving streamed output', async () => {
    const runtime = new NodeRuntime({ timeoutMs: 2500 });
    const result = await runtime.run(request('console.log("started"); while(true) {}'));
    expect(result.lines).toEqual(['started']);
    expect(result.error).toContain('exceeded');
  });
  it('stops a process when output arrives', async () => {
    const runtime = new NodeRuntime();
    const result = await runtime.run(
      request('console.log("started"); await new Promise(() => {});'),
      () => runtime.stop(),
    );
    expect(result.lines).toEqual(['started']);
    expect(result.error).toBe('Execution stopped.');
  });
  it('reports an unexpected exit and rejects invalid requests', async () => {
    expect((await new NodeRuntime().run(request('process.exit(0);'))).error).toContain('exited');
    expect(validRequest({ ...request(''), code: 'x'.repeat(100_001) })).toBe(false);
    await expect(new NodeRuntime().run({ ...request(''), environment: 'browser' })).rejects.toThrow(
      'Invalid Node',
    );
  });
  it('exposes custom variables through process.env alongside the real Node process object', async () => {
    const result = await new NodeRuntime().run({
      ...request('console.log(process.env.API_KEY, typeof process.versions.node);'),
      env: { API_KEY: 'secret-value' },
    });
    expect(result.error).toBeUndefined();
    expect(result.lines).toEqual(['secret-value string']);
  });
  it('does not inherit custom variables from an earlier unrelated run', async () => {
    const result = await new NodeRuntime().run(request('console.log(typeof process.env.API_KEY);'));
    expect(result.lines).toEqual(['undefined']);
  });
  it('rejects a request whose environment variables are malformed', () => {
    expect(validRequest({ ...request(''), env: { 'bad key': 'x' } })).toBe(false);
    expect(validRequest({ ...request(''), env: { OK: 'x' } })).toBe(true);
  });
});
