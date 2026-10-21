/** Verifies worker timeout, cancellation, and stale-message handling without starting browser workers. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserRuntime } from '../src/runtime';
import type { ExecutionMessage } from '../src/execution';

/** Records lifecycle operations and delivers controlled worker messages to the runtime under test. */
class TestWorker {
  static instances: TestWorker[] = [];
  onmessage?: (event: { data: ExecutionMessage }) => void;
  onerror?: (event: { message: string }) => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  /** Registers this instance so a test can address the worker created by the runtime. */
  constructor() {
    TestWorker.instances.push(this);
  }
  /** @param data Worker event to deliver to the runtime under test. */
  send(data: ExecutionMessage) {
    this.onmessage?.({ data });
  }
}

describe('execution lifecycle', () => {
  beforeEach(() => {
    TestWorker.instances = [];
    vi.stubGlobal('Worker', TestWorker);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('terminates timed out runs and preserves streamed output', async () => {
    const runtime = new BrowserRuntime();
    const pending = runtime.run({ id: 'timeout', code: '', environment: 'browser' });
    const worker = TestWorker.instances[0];
    worker.send({ type: 'output', id: 'timeout', line: 'before loop' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({
      id: 'timeout',
      lines: ['before loop'],
      error: 'Execution exceeded 5 seconds.',
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('stops immediately and keeps output already received', async () => {
    const runtime = new BrowserRuntime();
    const pending = runtime.run({ id: 'stop', code: '', environment: 'browser' });
    const worker = TestWorker.instances[0];
    worker.send({ type: 'output', id: 'stop', line: 'partial' });
    runtime.stop();
    expect(await pending).toEqual({ id: 'stop', lines: ['partial'], error: 'Execution stopped.' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces the previous run and ignores messages belonging to another run', async () => {
    const runtime = new BrowserRuntime();
    const previous = runtime.run({ id: 'old', code: '', environment: 'browser' });
    const output = vi.fn();
    const next = runtime.run({ id: 'new', code: '', environment: 'browser' }, output);
    expect((await previous).error).toBe('Execution stopped.');
    const worker = TestWorker.instances[1];
    worker.send({ type: 'output', id: 'old', line: 'stale' });
    worker.send({ type: 'complete', result: { id: 'new', lines: ['current'] } });
    expect(output).not.toHaveBeenCalled();
    expect(await next).toEqual({ id: 'new', lines: ['current'] });
  });
});
