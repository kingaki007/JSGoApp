/** Wires the New/Close/Clear/Reopen tab actions to their keyboard shortcuts and toolbar buttons. */
import { useCallback } from 'react';
import type { FeatureAccess, Language } from '@code-editor/core';
import type { useAutoRun } from './useAutoRun';
import type { useDrafts } from './useDrafts';
import { tabTitle } from './useDrafts';
import type { WorkspaceSettings } from './settings';
import { useRunShortcuts } from './useRunShortcuts';
import { useClearShortcut } from './useClearShortcut';
import { useReopenShortcut } from './useReopenShortcut';
import { useTabShortcuts } from './useTabShortcuts';

interface WorkbenchShortcutsOptions {
  features: FeatureAccess;
  settings: WorkspaceSettings;
  ready: boolean;
  /** The active tab's displayed title, used in its own Clear confirmation. */
  activeTitle: string;
  drafts: ReturnType<typeof useDrafts>;
  autoRun: ReturnType<typeof useAutoRun>;
}

/**
 * Centralizes the actions shared by the toolbar buttons and their keyboard shortcuts, so the
 * confirmation logic for discarding code is written once.
 * @param options Plan access, preferences, readiness, and the drafts/auto-run state to act on.
 */
export function useWorkbenchShortcuts({
  features,
  settings,
  ready,
  activeTitle,
  drafts,
  autoRun,
}: WorkbenchShortcutsOptions) {
  const { active } = drafts;

  /** Creates a new tab in the given language, same as the +JS/+TS buttons. */
  const addTab = useCallback(
    (language: Language) => {
      autoRun.stop();
      drafts.addTab(language);
    },
    [autoRun.stop, drafts.addTab],
  );

  /** Closes a tab, confirming first unless Confirm close is turned off; same as the × button. */
  const closeTab = useCallback(
    (id: string) => {
      const tab = drafts.tabs.find((candidate) => candidate.id === id);
      const title = tab && (features.autoTabTitles ? tabTitle(tab) : tab.name);
      if (
        settings.confirmClose &&
        tab?.code.trim() &&
        !window.confirm(`Close ${title} and discard its code?`)
      )
        return;
      if (id === active.id) autoRun.stop();
      drafts.closeTab(id);
    },
    [
      active.id,
      autoRun.stop,
      drafts.closeTab,
      drafts.tabs,
      features.autoTabTitles,
      settings.confirmClose,
    ],
  );

  /** Clears the active tab's code, confirming first unless Confirm close is turned off. */
  const clearActiveTab = useCallback(() => {
    if (!active.code.trim()) return;
    if (settings.confirmClose && !window.confirm(`Clear ${activeTitle} and discard its code?`))
      return;
    drafts.updateCode(active.id, '');
  }, [active.id, active.code, activeTitle, drafts.updateCode, settings.confirmClose]);

  useRunShortcuts({
    enabled: features.runShortcuts && ready,
    onRun: autoRun.runNow,
    onStop: autoRun.stop,
  });
  useClearShortcut({
    enabled: features.clearEditor && ready,
    onClear: clearActiveTab,
  });
  useReopenShortcut({
    enabled: features.reopenClosedTab && ready,
    onReopen: drafts.reopenClosedTab,
  });
  useTabShortcuts({
    enabled: features.tabShortcuts && ready,
    onNewTab: () => addTab(settings.defaultLanguage),
    onCloseTab: () => closeTab(active.id),
  });

  return { addTab, closeTab, clearActiveTab };
}
