/** Verifies the Browser page lifecycle: start, streamed output, limits, cancellation, and untrusted messages. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/runtime';
import { frameDocument, type FrameHost } from '../src/frameHost';

/** Stands in for the sandboxed page so tests control exactly what it posts. */
class TestHost implements FrameHost {
  post = vi.fn();
  dispose = vi.fn();
  private listener?: (message: unknown) => void;
  /** @param listener Runtime handler that receives this page's messages. */
  onMessage(listener: (message: unknown) => void) {
    this.listener = listener;
  }
  /** @param message Message to deliver as if the page had posted it. */
  send(message: unknown) {
    this.listener?.(message);
  }
}

/** Creates a runtime whose pages are test hosts, exposed in creation order. */
function fixture() {
  const hosts: TestHost[] = [];
  const runtime = new BrowserRuntime({
    createHost: async () => {
      const host = new TestHost();
      hosts.push(host);
      return host;
    },
  });
  return { runtime, hosts };
}

/** @param id Run identifier for a Browser request with empty code. */
function request(id: string) {
  return { id, code: '', environment: 'browser' as const };
}

describe('browser page lifecycle', () => {
  beforeEach(() => void vi.useFakeTimers());
  afterEach(() => void vi.useRealTimers());

  it('sends the request with its time limit once the page is ready, then streams and completes', async () => {
    const { runtime, hosts } = fixture();
    const output = vi.fn();
    const pending = runtime.run({ ...request('run'), inspect: true }, output);
    await vi.advanceTimersByTimeAsync(0);
    const host = hosts[0];
    expect(host.post).not.toHaveBeenCalled();
    host.send({ type: 'ready' });
    expect(host.post).toHaveBeenCalledWith({ ...request('run'), inspect: true, timeoutMs: 5000 });
    const values = [{ type: 'object', text: 'Object', entries: [] }];
    host.send({ type: 'output', id: 'run', line: '{}', sourceLine: 3, values });
    host.send({ type: 'complete', result: { id: 'run' } });
    expect(await pending).toEqual({
      id: 'run',
      lines: ['{}'],
      sourceLines: [3],
      details: [values],
    });
    expect(output).toHaveBeenCalledWith('{}', 3, values);
    expect(host.dispose).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports the page error and keeps earlier output', async () => {
    const { runtime, hosts } = fixture();
    const pending = runtime.run(request('error'));
    await vi.advanceTimersByTimeAsync(0);
    hosts[0].send({ type: 'output', id: 'error', line: 'started' });
    hosts[0].send({ type: 'complete', result: { id: 'error', error: 'Something broke' } });
    expect(await pending).toEqual({
      id: 'error',
      lines: ['started'],
      sourceLines: [0],
      details: [null],
      error: 'Something broke',
    });
  });

  it('ends runs that never finish and preserves streamed output', async () => {
    const { runtime, hosts } = fixture();
    const pending = runtime.run(request('timeout'));
    await vi.advanceTimersByTimeAsync(0);
    hosts[0].send({ type: 'output', id: 'timeout', line: 'before wait' });
    // The page's own loop guard gets a short head start before the host gives up.
    await vi.advanceTimersByTimeAsync(5000);
    expect(hosts[0].dispose).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toEqual({
      id: 'timeout',
      lines: ['before wait'],
      sourceLines: [0],
      details: [null],
      error: 'Execution exceeded 5 seconds.',
    });
    expect(hosts[0].dispose).toHaveBeenCalledOnce();
  });

  it('stops immediately and keeps output already received', async () => {
    const { runtime, hosts } = fixture();
    const pending = runtime.run(request('stop'));
    await vi.advanceTimersByTimeAsync(0);
    hosts[0].send({ type: 'output', id: 'stop', line: 'partial' });
    runtime.stop();
    expect(await pending).toMatchObject({ lines: ['partial'], error: 'Execution stopped.' });
    expect(hosts[0].dispose).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('disposes a page that finishes loading after its run was stopped', async () => {
    const { runtime, hosts } = fixture();
    const pending = runtime.run(request('early-stop'));
    runtime.stop();
    expect((await pending).error).toBe('Execution stopped.');
    await vi.advanceTimersByTimeAsync(0);
    expect(hosts[0].dispose).toHaveBeenCalledOnce();
    expect(hosts[0].post).not.toHaveBeenCalled();
  });

  it('replaces the previous run and ignores stale or malformed messages', async () => {
    const { runtime, hosts } = fixture();
    const previous = runtime.run(request('old'));
    await vi.advanceTimersByTimeAsync(0);
    const output = vi.fn();
    const next = runtime.run(request('new'), output);
    expect((await previous).error).toBe('Execution stopped.');
    await vi.advanceTimersByTimeAsync(0);
    const host = hosts[1];
    host.send({ type: 'output', id: 'old', line: 'stale' });
    host.send({ type: 'output', id: 'new', line: 42 });
    host.send({ type: 'complete', result: { id: 'old' } });
    host.send('not an object');
    expect(output).not.toHaveBeenCalled();
    host.send({ type: 'output', id: 'new', line: 'current', values: [{ type: 'script' }] });
    host.send({ type: 'complete', result: { id: 'new' } });
    expect(await next).toEqual({
      id: 'new',
      lines: ['current'],
      sourceLines: [0],
      details: [null],
    });
  });

  it('reports a page that cannot start and rejects other environments', async () => {
    const runtime = new BrowserRuntime({
      createHost: () => Promise.reject(new Error('blocked')),
    });
    expect((await runtime.run(request('blocked'))).error).toBe(
      'The Browser page could not start. blocked',
    );
    await expect(runtime.run({ id: 'node', code: '', environment: 'node' })).rejects.toThrow(
      'Expected the Browser environment.',
    );
  });

  it('builds a page with a root mount point around the runner script', () => {
    const page = frameDocument('window.ready = true;');
    expect(page).toContain('<div id="root"></div>');
    expect(page).toContain('<script>window.ready = true;</script>');
  });
});
