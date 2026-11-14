/** Verifies that new tabs start auto-titled and that renaming locks the title permanently. */
// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDrafts } from '../src/useDrafts';
import type { ScratchTab } from '../src/draftStorage';

type Controls = ReturnType<typeof useDrafts>;
let controls: Controls;
let root: Root;
let container: HTMLDivElement;

const defaults: ScratchTab[] = [{ id: 'js', name: 'scratch.js', language: 'javascript', code: '' }];

/** Mounts the hook so its latest return value is captured in `controls`. */
function Harness() {
  controls = useDrafts(defaults, 'js');
  return null;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => {},
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    ),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('useDrafts tab titles', () => {
  it('marks a newly created tab as auto-titled', () => {
    act(() => controls.addTab('typescript'));
    const created = controls.tabs.find((tab) => tab.id === controls.active.id)!;
    expect(created.autoTitled).toBe(true);
    expect(created.code).toBe('');
  });

  it('locks the title on rename, even to the same text the auto title would show', () => {
    act(() => controls.addTab('typescript'));
    const id = controls.active.id;
    act(() => controls.updateCode(id, 'const greeting = 1;'));
    expect(controls.tabs.find((tab) => tab.id === id)?.autoTitled).toBe(true);
    act(() => controls.renameTab(id, 'const greeting = 1;'));
    const renamed = controls.tabs.find((tab) => tab.id === id)!;
    expect(renamed.autoTitled).toBe(false);
    expect(renamed.name).toBe('const greeting = 1;');
    // Further edits no longer move the title; it stays exactly what was chosen.
    act(() => controls.updateCode(id, 'something else entirely'));
    expect(controls.tabs.find((tab) => tab.id === id)?.name).toBe('const greeting = 1;');
  });

  it('leaves the original default tabs as explicitly named, not auto-titled', () => {
    expect(controls.active.autoTitled).toBeFalsy();
  });

  it('ignores a blank rename, keeping the tab auto-titled', () => {
    act(() => controls.addTab('javascript'));
    const id = controls.active.id;
    act(() => controls.renameTab(id, '   '));
    expect(controls.tabs.find((tab) => tab.id === id)?.autoTitled).toBe(true);
  });
});

describe('useDrafts reopening closed tabs', () => {
  it('restores the most recently closed tab with its original code and id', () => {
    act(() => controls.addTab('typescript'));
    const id = controls.active.id;
    act(() => controls.updateCode(id, 'const kept = true;'));
    expect(controls.canReopenClosedTab).toBe(false);
    act(() => controls.closeTab(id));
    expect(controls.tabs.some((tab) => tab.id === id)).toBe(false);
    expect(controls.canReopenClosedTab).toBe(true);
    act(() => controls.reopenClosedTab());
    const restored = controls.tabs.find((tab) => tab.id === id);
    expect(restored?.code).toBe('const kept = true;');
    expect(controls.active.id).toBe(id);
    expect(controls.canReopenClosedTab).toBe(false);
  });

  it('reopens closed tabs most-recent first, and does nothing once the stack is empty', () => {
    act(() => controls.addTab('javascript'));
    const first = controls.active.id;
    act(() => controls.addTab('javascript'));
    const second = controls.active.id;
    act(() => controls.closeTab(first));
    act(() => controls.closeTab(second));
    act(() => controls.reopenClosedTab());
    expect(controls.active.id).toBe(second);
    act(() => controls.reopenClosedTab());
    expect(controls.active.id).toBe(first);
    const tabsBefore = controls.tabs;
    act(() => controls.reopenClosedTab());
    expect(controls.tabs).toBe(tabsBefore);
  });
});
