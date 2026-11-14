/** Verifies the Reopen key combination, browser-default override, and enablement gating. */
// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReopenShortcut, type ReopenShortcutOptions } from '../src/useReopenShortcut';

let root: Root;
let container: HTMLDivElement;

/** @param options Enablement and the spy under test. */
function Harness(options: ReopenShortcutOptions) {
  useReopenShortcut(options);
  return null;
}

/** @param options Shortcut options to mount with. @param strict Exercises development Strict Mode. */
function render(options: ReopenShortcutOptions, strict = false) {
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

describe('reopen shortcut', () => {
  it('reopens on Ctrl+Shift+T, overriding the browser default', () => {
    const onReopen = vi.fn();
    render({ enabled: true, onReopen });
    const event = press('t', { ctrlKey: true, shiftKey: true });
    expect(onReopen).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('accepts Cmd on macOS and is case-insensitive', () => {
    const onReopen = vi.fn();
    render({ enabled: true, onReopen });
    press('T', { metaKey: true, shiftKey: true });
    expect(onReopen).toHaveBeenCalledOnce();
  });

  it('ignores the plain key, other letters, Alt combinations, and a missing Shift', () => {
    const onReopen = vi.fn();
    render({ enabled: true, onReopen });
    const plain = press('t');
    expect(plain.defaultPrevented).toBe(false);
    press('t', { ctrlKey: true });
    press('y', { ctrlKey: true, shiftKey: true });
    press('t', { ctrlKey: true, shiftKey: true, altKey: true });
    expect(onReopen).not.toHaveBeenCalled();
  });

  it('does nothing while disabled, and stops listening once unmounted', () => {
    const onReopen = vi.fn();
    render({ enabled: false, onReopen });
    press('t', { ctrlKey: true, shiftKey: true });
    expect(onReopen).not.toHaveBeenCalled();
    render({ enabled: true, onReopen });
    press('t', { ctrlKey: true, shiftKey: true });
    expect(onReopen).toHaveBeenCalledOnce();
    act(() => root.unmount());
    press('t', { ctrlKey: true, shiftKey: true });
    expect(onReopen).toHaveBeenCalledOnce();
  });

  it('keeps exactly one listener across Strict Mode double-invocation and rerenders', () => {
    const onReopen = vi.fn();
    render({ enabled: true, onReopen }, true);
    press('t', { ctrlKey: true, shiftKey: true });
    expect(onReopen).toHaveBeenCalledOnce();
    render({ enabled: true, onReopen }, true);
    press('t', { ctrlKey: true, shiftKey: true });
    expect(onReopen).toHaveBeenCalledTimes(2);
  });
});
