/** Manages scratchpad edits, debounced local persistence, and lifecycle flushes before navigation. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Language } from '@code-editor/core';
import { loadDrafts, saveDrafts, type DraftSnapshot } from './draftStorage';

type SaveState = 'idle' | 'pending' | 'saved' | 'error';

/**
 * Restores drafts once and keeps edits responsive while batching storage writes.
 * @param defaults Example code used only when no valid saved snapshot can be restored.
 */
export function useDrafts(defaults: Record<Language, string>) {
  const [initial] = useState(loadDrafts);
  const [snapshot, setSnapshot] = useState<DraftSnapshot>(
    () =>
      initial.snapshot ?? {
        version: 1,
        language: 'typescript',
        drafts: defaults,
      },
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
   * @param next Complete replacement snapshot containing the latest drafts and language.
   */
  function update(next: DraftSnapshot) {
    latest.current = next;
    dirty.current = true;
    setSnapshot(next);
    setError(null);
    setSaveState('pending');
  }

  return {
    language: snapshot.language,
    drafts: snapshot.drafts,
    /** @param language Scratchpad to activate and remember for the next visit. */
    setLanguage(language: Language) {
      if (latest.current.language !== language) update({ ...latest.current, language });
    },
    /**
     * Changes one scratchpad without losing the other language's code.
     * @param language Language whose draft changed.
     * @param value Complete new source text, including an intentionally empty string.
     */
    updateDraft(language: Language, value: string) {
      if (latest.current.drafts[language] === value) return;
      update({ ...latest.current, drafts: { ...latest.current.drafts, [language]: value } });
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
