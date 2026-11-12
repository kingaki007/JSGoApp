/** Manages scratchpad tabs, debounced local persistence, and lifecycle flushes before navigation. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { languages, type Language } from '@code-editor/core';
import {
  loadDrafts,
  maxTabNameLength,
  maxTabs,
  saveDrafts,
  type DraftSnapshot,
  type ScratchTab,
} from './draftStorage';

type SaveState = 'idle' | 'pending' | 'saved' | 'error';

/**
 * Picks the first unused `untitled-N` name for a new tab.
 * @param tabs Existing tabs whose names must not be repeated.
 * @param language Language that determines the file extension.
 */
export function nextTabName(tabs: readonly ScratchTab[], language: Language): string {
  const names = new Set(tabs.map((tab) => tab.name));
  for (let index = 1; ; index++) {
    const name = `untitled-${index}.${languages[language].extension}`;
    if (!names.has(name)) return name;
  }
}

/**
 * Restores tabs once and keeps edits responsive while batching storage writes.
 * @param defaults Example tabs used only when no valid saved snapshot can be restored.
 * @param defaultActiveId Example tab shown first on a new device.
 */
export function useDrafts(defaults: ScratchTab[], defaultActiveId: string) {
  const [initial] = useState(loadDrafts);
  const [snapshot, setSnapshot] = useState<DraftSnapshot>(
    () => initial.snapshot ?? { version: 2, activeId: defaultActiveId, tabs: defaults },
  );
  const latest = useRef(snapshot);
  const dirty = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>(
    initial.error ? 'error' : initial.snapshot ? 'saved' : 'idle',
  );
  const [error, setError] = useState(initial.error);

  /** Writes the latest dirty snapshot; refs also cover edits made just before pagehide. */
  const persist = useCallback(() => {
    if (!dirty.current) return;
    const failure = saveDrafts(latest.current);
    setError(failure);
    setSaveState(failure ? 'error' : 'saved');
    if (!failure) dirty.current = false;
  }, []);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(persist, 500);
    return () => clearTimeout(timer);
  }, [snapshot, persist]);

  useEffect(() => {
    /** Flushes pending edits when the tab is hidden, including mobile page lifecycle changes. */
    const onHidden = () => {
      if (document.visibilityState === 'hidden') persist();
    };
    window.addEventListener('pagehide', persist);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', onHidden);
      persist();
    };
  }, [persist]);

  /**
   * Updates editor state and marks it for the next debounced save.
   * @param next Complete replacement snapshot containing the latest tabs and active tab.
   */
  function update(next: DraftSnapshot) {
    latest.current = next;
    dirty.current = true;
    setSnapshot(next);
    setError(null);
    setSaveState('pending');
  }

  /**
   * Replaces one tab while leaving the others untouched.
   * @param id Tab to change; unknown identifiers are ignored.
   * @param change Returns the replacement, or the same tab when nothing changed.
   */
  function updateTab(id: string, change: (tab: ScratchTab) => ScratchTab) {
    const current = latest.current;
    const index = current.tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const next = change(current.tabs[index]);
    if (next === current.tabs[index]) return;
    update({
      ...current,
      tabs: current.tabs.map((tab, position) => (position === index ? next : tab)),
    });
  }

  return {
    tabs: snapshot.tabs,
    active: snapshot.tabs.find((tab) => tab.id === snapshot.activeId) ?? snapshot.tabs[0],
    canAddTab: snapshot.tabs.length < maxTabs,
    /** @param id Tab to show and remember for the next visit. */
    selectTab(id: string) {
      const current = latest.current;
      if (current.activeId !== id && current.tabs.some((tab) => tab.id === id))
        update({ ...current, activeId: id });
    },
    /**
     * Changes one tab's code without affecting the others.
     * @param id Tab whose code changed.
     * @param value Complete new source text, including an intentionally empty string.
     */
    updateCode(id: string, value: string) {
      updateTab(id, (tab) => (tab.code === value ? tab : { ...tab, code: value }));
    },
    /** @param language Language of the new empty tab, which becomes active. */
    addTab(language: Language) {
      const current = latest.current;
      if (current.tabs.length >= maxTabs) return;
      const tab: ScratchTab = {
        id: crypto.randomUUID(),
        name: nextTabName(current.tabs, language),
        language,
        code: '',
      };
      update({ ...current, activeId: tab.id, tabs: [...current.tabs, tab] });
    },
    /** @param id Tab to remove with its code; the last remaining tab is kept. */
    closeTab(id: string) {
      const current = latest.current;
      const index = current.tabs.findIndex((tab) => tab.id === id);
      if (index < 0 || current.tabs.length === 1) return;
      const tabs = current.tabs.filter((tab) => tab.id !== id);
      const activeId =
        current.activeId === id ? tabs[Math.min(index, tabs.length - 1)].id : current.activeId;
      update({ ...current, activeId, tabs });
    },
    /**
     * Changes a tab's display name; its language and code are unaffected.
     * @param id Tab to rename.
     * @param name Requested name; blank names are ignored and long names are shortened.
     */
    renameTab(id: string, name: string) {
      const trimmed = name.trim().slice(0, maxTabNameLength);
      if (trimmed) updateTab(id, (tab) => (tab.name === trimmed ? tab : { ...tab, name: trimmed }));
    },
    saveState,
    saveMessage:
      error ??
      (saveState === 'pending'
        ? 'Saving on this device…'
        : saveState === 'saved'
          ? 'Drafts saved on this device.'
          : 'Edits are saved on this device. No account needed.'),
  };
}
