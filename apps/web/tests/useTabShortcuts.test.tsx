/** Verifies the New Tab / Close Tab key combinations, browser-default override, and gating. */
// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTabShortcuts, type TabShortcutsOptions } from '../src/useTabShortcuts';

let root: Root;
let container: HTMLDivElement;

/** @param options Enablement and the two spies under test. */
function Harness(options: TabShortcutsOptions) {
  useTabShortcuts(options);
  return null;
}

/** @param options Shortcut options to mount with. @param strict Exercises development Strict Mode. */
function render(options: TabShortcutsOptions, strict = false) {
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

describe('tab shortcuts', () => {
  it('creates a tab on Ctrl+T and closes one on Ctrl+W, overriding the browser default', () => {
    const onNewTab = vi.fn();
    const onCloseTab = vi.fn();
    render({ enabled: true, onNewTab, onCloseTab });
    const newEvent = press('t', { ctrlKey: true });
    expect(onNewTab).toHaveBeenCalledOnce();
    expect(onCloseTab).not.toHaveBeenCalled();
    expect(newEvent.defaultPrevented).toBe(true);
    const closeEvent = press('w', { ctrlKey: true });
    expect(onCloseTab).toHaveBeenCalledOnce();
    expect(onNewTab).toHaveBeenCalledOnce();
    expect(closeEvent.defaultPrevented).toBe(true);
  });

  it('accepts Cmd on macOS and is case-insensitive', () => {
    const onNewTab = vi.fn();
    render({ enabled: true, onNewTab, onCloseTab: vi.fn() });
    press('T', { metaKey: true });
    expect(onNewTab).toHaveBeenCalledOnce();
  });

  it('ignores the plain key, other letters, and Shift/Alt combinations', () => {
    const onNewTab = vi.fn();
    const onCloseTab = vi.fn();
    render({ enabled: true, onNewTab, onCloseTab });
    const plain = press('t');
    expect(plain.defaultPrevented).toBe(false);
    press('x', { ctrlKey: true });
    press('t', { ctrlKey: true, shiftKey: true });
    press('w', { ctrlKey: true, altKey: true });
    expect(onNewTab).not.toHaveBeenCalled();
    expect(onCloseTab).not.toHaveBeenCalled();
  });

  it('does nothing while disabled, and stops listening once unmounted', () => {
    const onNewTab = vi.fn();
    render({ enabled: false, onNewTab, onCloseTab: vi.fn() });
    press('t', { ctrlKey: true });
    expect(onNewTab).not.toHaveBeenCalled();
    render({ enabled: true, onNewTab, onCloseTab: vi.fn() });
    press('t', { ctrlKey: true });
    expect(onNewTab).toHaveBeenCalledOnce();
    act(() => root.unmount());
    press('t', { ctrlKey: true });
    expect(onNewTab).toHaveBeenCalledOnce();
  });

  it('keeps exactly one listener across Strict Mode double-invocation and rerenders', () => {
    const onNewTab = vi.fn();
    render({ enabled: true, onNewTab, onCloseTab: vi.fn() }, true);
    press('t', { ctrlKey: true });
    expect(onNewTab).toHaveBeenCalledOnce();
    render({ enabled: true, onNewTab, onCloseTab: vi.fn() }, true);
    press('t', { ctrlKey: true });
    expect(onNewTab).toHaveBeenCalledTimes(2);
  });
});
