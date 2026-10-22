/** Checks debounce timing, latest-source execution, manual overrides, and React lifecycle cleanup. */
// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autoRunDelayMs, useAutoRun } from '../src/useAutoRun';

type Options = Parameters<typeof useAutoRun>[0];
let controls: ReturnType<typeof useAutoRun>;
let root: Root;
let container: HTMLDivElement;

/** @param options Debounce inputs and execution callbacks provided by the test. */
function Harness(options: Options) {
  controls = useAutoRun(options);
  return null;
}

/** Creates independent callbacks for each test so rerenders can retain stable callback identities. */
function defaults(): Options {
  return {
    source: 'console.log(1);',
    ready: true,
    enabled: true,
    run: vi.fn(),
    cancelExecution: vi.fn(),
    clearOutput: vi.fn(),
  };
}

/** @param options Updated hook inputs. @param strict Exercises development Strict Mode when true. */
function render(options: Options, strict = false) {
  act(() =>
    root.render(
      strict ? (
        <StrictMode>
          <Harness {...options} />
        </StrictMode>
      ) : (
        <Harness {...options} />
      ),
    ),
  );
}

/** @param milliseconds Amount of simulated editing idle time. */
function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('automatic execution', () => {
  it('waits for editor readiness and two seconds of idle time', () => {
    const options = defaults();
    render({ ...options, ready: false });
    advance(5000);
    expect(options.run).not.toHaveBeenCalled();
    render(options);
    expect(controls.isPending).toBe(true);
    advance(autoRunDelayMs - 1);
    expect(options.run).not.toHaveBeenCalled();
    advance(1);
    expect(options.run).toHaveBeenCalledOnce();
    expect(controls.isPending).toBe(false);
  });

  it('resets the deadline and executes only the latest edited snapshot', () => {
    const options = defaults();
    render(options);
    advance(1500);
    const latest = vi.fn();
    render({ ...options, source: 'console.log(2);', run: latest });
    advance(1999);
    expect(options.run).not.toHaveBeenCalled();
    expect(latest).not.toHaveBeenCalled();
    advance(1);
    expect(latest).toHaveBeenCalledOnce();
    expect(options.cancelExecution).toHaveBeenCalledTimes(2);
  });

  it('does not rerun because output or another unrelated state change causes a render', () => {
    const options = defaults();
    render(options);
    advance(2000);
    render({ ...options });
    advance(10_000);
    expect(options.run).toHaveBeenCalledOnce();
  });

  it('lets manual Run execute immediately without a second automatic execution', () => {
    const options = defaults();
    render(options);
    advance(500);
    act(() => controls.runNow());
    expect(options.run).toHaveBeenCalledOnce();
    expect(controls.isPending).toBe(false);
    advance(5000);
    expect(options.run).toHaveBeenCalledOnce();
  });

  it('keeps Stop effective until another edit or context change schedules work', () => {
    const options = defaults();
    render(options);
    advance(1000);
    act(() => controls.stop());
    advance(5000);
    expect(options.run).not.toHaveBeenCalled();
    expect(controls.isPending).toBe(false);
    render({ ...options, source: 'console.log(3);' });
    advance(2000);
    expect(options.run).toHaveBeenCalledOnce();
  });

  it('cancels pending work when disabled and preserves manual Run', () => {
    const options = defaults();
    render(options);
    advance(1000);
    render({ ...options, enabled: false });
    advance(5000);
    expect(options.run).not.toHaveBeenCalled();
    act(() => controls.runNow());
    expect(options.run).toHaveBeenCalledOnce();
    render(options);
    advance(2000);
    expect(options.run).toHaveBeenCalledTimes(2);
  });

  it('clears empty drafts without launching work', () => {
    const options = defaults();
    render(options);
    render({ ...options, source: '  \n' });
    advance(5000);
    expect(options.run).not.toHaveBeenCalled();
    expect(options.clearOutput).toHaveBeenCalledOnce();
    expect(controls.isPending).toBe(false);
  });

  it('replaces a pending language/environment callback even if the source text is unchanged', () => {
    const options = defaults();
    render(options);
    advance(1000);
    const nextEnvironment = vi.fn();
    render({ ...options, run: nextEnvironment });
    advance(2000);
    expect(options.run).not.toHaveBeenCalled();
    expect(nextEnvironment).toHaveBeenCalledOnce();
  });

  it('schedules once in Strict Mode and clears pending work when unmounted', () => {
    const options = defaults();
    render(options, true);
    advance(2000);
    expect(options.run).toHaveBeenCalledOnce();
    render({ ...options, source: 'console.log(4);' }, true);
    act(() => root.render(null));
    advance(5000);
    expect(options.run).toHaveBeenCalledOnce();
  });
});
