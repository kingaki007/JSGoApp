/** Binds the Reopen-closed-tab keyboard shortcut, overriding the browser's own Ctrl+Shift+T binding. */
import { useEffect } from 'react';

export interface ReopenShortcutOptions {
  /** Whether the shortcut is active; disabled plans fall back to the Reopen button alone. */
  enabled: boolean;
  /** Triggered by Ctrl+Shift+T (Cmd+Shift+T on macOS). */
  onReopen(): void;
}

/**
 * Listens on the whole window, so the shortcut works regardless of focus.
 * @param options Enablement and the action to trigger.
 */
export function useReopenShortcut({ enabled, onReopen }: ReopenShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;
    /** @param event Any key press on the page; only the exact Reopen combination is handled. */
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || !event.shiftKey || event.altKey || event.key.toLowerCase() !== 't') return;
      event.preventDefault();
      onReopen();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onReopen]);
}
