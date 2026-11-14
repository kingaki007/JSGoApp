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
