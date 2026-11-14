/** Verifies the Run/Stop key combinations, browser-reload override, and enablement gating. */
// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunShortcuts, type RunShortcutsOptions } from '../src/useRunShortcuts';

let root: Root;
let container: HTMLDivElement;

/** @param options Enablement and the two spies under test. */
function Harness(options: RunShortcutsOptions) {
  useRunShortcuts(options);
  return null;
}

/** @param options Shortcut options to mount with. @param strict Exercises development Strict Mode. */
function render(options: RunShortcutsOptions, strict = false) {
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

/** @param key Key name. @param options Modifier keys to combine with it. */
function press(key: string, options: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('run/stop shortcuts', () => {
  it('runs on Ctrl+R and stops on Ctrl+Shift+R, overriding the browser default', () => {
    const onRun = vi.fn();
    const onStop = vi.fn();
    render({ enabled: true, onRun, onStop });
    const runEvent = press('r', { ctrlKey: true });
    expect(onRun).toHaveBeenCalledOnce();
    expect(onStop).not.toHaveBeenCalled();
    expect(runEvent.defaultPrevented).toBe(true);
    const stopEvent = press('r', { ctrlKey: true, shiftKey: true });
    expect(onStop).toHaveBeenCalledOnce();
    expect(onRun).toHaveBeenCalledOnce();
    expect(stopEvent.defaultPrevented).toBe(true);
  });

  it('accepts Cmd on macOS and is case-insensitive', () => {
    const onRun = vi.fn();
    render({ enabled: true, onRun, onStop: vi.fn() });
    press('R', { metaKey: true });
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('ignores the plain key, other letters, and Alt combinations', () => {
    const onRun = vi.fn();
    const onStop = vi.fn();
    render({ enabled: true, onRun, onStop });
    const plain = press('r');
    expect(plain.defaultPrevented).toBe(false);
    press('s', { ctrlKey: true });
    press('r', { ctrlKey: true, altKey: true });
    expect(onRun).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('does nothing while disabled, and stops listening once unmounted', () => {
    const onRun = vi.fn();
    render({ enabled: false, onRun, onStop: vi.fn() });
    press('r', { ctrlKey: true });
    expect(onRun).not.toHaveBeenCalled();
    render({ enabled: true, onRun, onStop: vi.fn() });
    press('r', { ctrlKey: true });
    expect(onRun).toHaveBeenCalledOnce();
    act(() => root.unmount());
    press('r', { ctrlKey: true });
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('keeps exactly one listener across Strict Mode double-invocation and rerenders', () => {
    const onRun = vi.fn();
    render({ enabled: true, onRun, onStop: vi.fn() }, true);
    press('r', { ctrlKey: true });
    expect(onRun).toHaveBeenCalledOnce();
    render({ enabled: true, onRun, onStop: vi.fn() }, true);
    press('r', { ctrlKey: true });
    expect(onRun).toHaveBeenCalledTimes(2);
  });
});
