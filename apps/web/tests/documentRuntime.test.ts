/** Checks preview source escaping, message boundaries, cancellation, and late interactive output. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewDocument, DocumentRuntime } from '../src/documentRuntime';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Creates a minimal frame and message surface without executing user code in the host test process. */
function setup() {
  const host = new EventTarget();
  vi.stubGlobal('window', host);
  const frame = { srcdoc: '', contentWindow: {} } as HTMLIFrameElement;
  const runtime = new DocumentRuntime();
  runtime.attach(frame);
  /** @param data Message payload. @param source Sender window; defaults to the active preview. */
  function send(data: unknown, source: unknown = frame.contentWindow) {
    const event = Object.assign(new Event('message'), { data, source, origin: 'null' });
    host.dispatchEvent(event);
  }
  return { frame, runtime, send };
}

describe('document execution', () => {
  it('keeps HTML-looking source inside its encoded script payload', () => {
    const html = createPreviewDocument({
      id: 'one',
      code: 'console.log("</script><h1>hello</h1>")',
      environment: 'browser',
    });
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain('\\u003c/script>');
    expect(html).toContain("connect-src 'none'");
  });

  it('rejects other senders and stale runs, then streams interaction logs after completion', async () => {
    const { runtime, send, frame } = setup();
    const output = vi.fn();
    const pending = runtime.run({ id: 'one', code: '', environment: 'browser' }, output);
    send({ type: 'output', id: 'one', line: 'spoof' }, {});
    send({ type: 'output', id: 'old', line: 'stale' });
    send({ type: 'output', id: 'one', line: 'ready' });
    send({ type: 'complete', id: 'one' });
    expect(await pending).toEqual({ id: 'one', lines: ['ready'] });
    send({ type: 'output', id: 'one', line: 'clicked' });
    expect(output.mock.calls).toEqual([['ready'], ['clicked']]);
    runtime.stop();
    send({ type: 'output', id: 'one', line: 'disposed' });
    expect(output).toHaveBeenCalledTimes(2);
    expect(frame.srcdoc).toBe('');
  });

  it('cancels pending asynchronous execution and clears its frame after the deadline', async () => {
    vi.useFakeTimers();
    const { runtime, frame } = setup();
    const pending = runtime.run({ id: 'one', code: '', environment: 'browser' });
    vi.advanceTimersByTime(5000);
    expect((await pending).error).toContain('exceeded 5 seconds');
    expect(frame.srcdoc).toBe('');
  });

  it('enforces host-side output limits even if the frame bypasses the console bridge', async () => {
    const { runtime, send } = setup();
    const pending = runtime.run({ id: 'one', code: '', environment: 'browser' });
    for (let index = 0; index < 600; index++) send({ type: 'output', id: 'one', line: 'x' });
    send({ type: 'complete', id: 'one' });
    expect((await pending).lines).toHaveLength(500);
    runtime.stop();
  });
});
