/** Binds the New Tab and Close Tab keyboard shortcuts, overriding the browser's own bindings. */
import { useEffect } from 'react';

export interface TabShortcutsOptions {
  /** Whether the shortcuts are active; disabled plans fall back to the tab buttons alone. */
  enabled: boolean;
  /** Triggered by Ctrl+T (Cmd+T on macOS). */
  onNewTab(): void;
  /** Triggered by Ctrl+W (Cmd+W on macOS). */
  onCloseTab(): void;
}

/**
 * Listens on the whole window, so the shortcuts work regardless of focus. Some browsers do not
 * let a page override Ctrl+T or Ctrl+W at all; `preventDefault` has no effect there.
 * @param options Enablement and the two actions to trigger.
 */
export function useTabShortcuts({ enabled, onNewTab, onCloseTab }: TabShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;
    /** @param event Any key press on the page; only the exact tab combinations are handled. */
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 't') {
        event.preventDefault();
        onNewTab();
      } else if (key === 'w') {
        event.preventDefault();
        onCloseTab();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onNewTab, onCloseTab]);
}
