/** Exercises actual disposable Node processes, including module loading, output limits, and cancellation. */
import { describe, expect, it, vi } from 'vitest';
import { NodeRuntime, validRequest } from '@code-editor/runtime-node';

/** @param code Source for a unique Node execution request. */
function request(code: string) {
  return { id: crypto.randomUUID(), code, environment: 'node' as const };
}

describe('shared Node runner', () => {
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
});
