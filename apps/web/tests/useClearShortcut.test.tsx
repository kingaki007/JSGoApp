/** Verifies the Clear key combination, browser-default override, and enablement gating. */
// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClearShortcut, type ClearShortcutOptions } from '../src/useClearShortcut';

let root: Root;
let container: HTMLDivElement;

/** @param options Enablement and the spy under test. */
function Harness(options: ClearShortcutOptions) {
  useClearShortcut(options);
  return null;
}

/** @param options Shortcut options to mount with. @param strict Exercises development Strict Mode. */
function render(options: ClearShortcutOptions, strict = false) {
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

describe('clear shortcut', () => {
  it('clears on Ctrl+Shift+K, overriding the browser default', () => {
    const onClear = vi.fn();
    render({ enabled: true, onClear });
    const event = press('k', { ctrlKey: true, shiftKey: true });
    expect(onClear).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('accepts Cmd on macOS and is case-insensitive', () => {
    const onClear = vi.fn();
    render({ enabled: true, onClear });
    press('K', { metaKey: true, shiftKey: true });
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('ignores the plain key, other letters, Alt combinations, and a missing Shift', () => {
    const onClear = vi.fn();
    render({ enabled: true, onClear });
    const plain = press('k');
    expect(plain.defaultPrevented).toBe(false);
    press('k', { ctrlKey: true });
    press('j', { ctrlKey: true, shiftKey: true });
    press('k', { ctrlKey: true, shiftKey: true, altKey: true });
    expect(onClear).not.toHaveBeenCalled();
  });

  it('does nothing while disabled, and stops listening once unmounted', () => {
    const onClear = vi.fn();
    render({ enabled: false, onClear });
    press('k', { ctrlKey: true, shiftKey: true });
    expect(onClear).not.toHaveBeenCalled();
    render({ enabled: true, onClear });
    press('k', { ctrlKey: true, shiftKey: true });
    expect(onClear).toHaveBeenCalledOnce();
    act(() => root.unmount());
    press('k', { ctrlKey: true, shiftKey: true });
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('keeps exactly one listener across Strict Mode double-invocation and rerenders', () => {
    const onClear = vi.fn();
    render({ enabled: true, onClear }, true);
    press('k', { ctrlKey: true, shiftKey: true });
    expect(onClear).toHaveBeenCalledOnce();
    render({ enabled: true, onClear }, true);
    press('k', { ctrlKey: true, shiftKey: true });
    expect(onClear).toHaveBeenCalledTimes(2);
  });
});
