/** Binds the Clear keyboard shortcut, overriding the browser's own Ctrl+Shift+K binding if any. */
import { useEffect } from 'react';

export interface ClearShortcutOptions {
  /** Whether the shortcut is active; disabled plans fall back to the Clear button alone. */
  enabled: boolean;
  /** Triggered by Ctrl+Shift+K (Cmd+Shift+K on macOS). */
  onClear(): void;
}

/**
 * Listens on the whole window, so the shortcut works regardless of focus.
 * @param options Enablement and the action to trigger.
 */
export function useClearShortcut({ enabled, onClear }: ClearShortcutOptions) {
  useEffect(() => {
    if (!enabled) return;
    /** @param event Any key press on the page; only the exact Clear combination is handled. */
    function onKeyDown(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || !event.shiftKey || event.altKey || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      onClear();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, onClear]);
}
