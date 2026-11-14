/** Binds the RunJS-style Run and Stop keyboard shortcuts, overriding the browser's reload keys. */
import { useEffect } from 'react';

export interface RunShortcutsOptions {
  /** Whether the shortcuts are active; disabled plans fall back to the Run/Stop buttons alone. */
  enabled: boolean;
  /** Triggered by Ctrl+R (Cmd+R on macOS); a no-op while already running is the caller's choice. */
  onRun(): void;
  /** Triggered by Ctrl+Shift+R (Cmd+Shift+R on macOS). */
  onStop(): void;
}

/**
 * Listens on the whole window, like RunJS's own app-wide shortcuts, since the browser's own
 * reload (Ctrl+R) and hard-reload (Ctrl+Shift+R) must be caught before they act on any focus.
 * @param options Enablement and the two actions to trigger.
 */
export function useRunShortcuts({ enabled, onRun, onStop }: RunShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;
    /** @param event Any key press on the page; only the exact Run/Stop combinations are handled. */
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey || event.key.toLowerCase() !== 'r') return;
      event.preventDefault();
      if (event.shiftKey) onStop();
      else onRun();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onRun, onStop]);
}
