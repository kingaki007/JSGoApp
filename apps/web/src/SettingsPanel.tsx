/** Presents workspace preferences in a keyboard-dismissible popover anchored to the header. */
import { useEffect, useId, useRef, useState } from 'react';
import { fontSizeRange, type WorkspaceSettings } from './settings';

const toggles = [
  { key: 'autoRun', label: 'Auto run', description: 'Run 2 seconds after typing stops' },
  { key: 'matchLines', label: 'Match lines', description: 'Show results beside their source line' },
  {
    key: 'showUndefined',
    label: 'Show undefined',
    description: 'Report undefined expression results',
  },
  { key: 'wordWrap', label: 'Word wrap', description: 'Wrap long lines in the editor' },
  { key: 'lineNumbers', label: 'Line numbers', description: 'Show the editor line-number gutter' },
] as const;

/**
 * Renders the Settings trigger and its popover.
 * @param props.settings Current preferences.
 * @param props.onChange Receives only the changed preferences.
 * @param props.matchLinesAvailable Whether the account's plan includes line-aligned results.
 */
export default function SettingsPanel({
  settings,
  onChange,
  matchLinesAvailable,
}: {
  settings: WorkspaceSettings;
  onChange(patch: Partial<WorkspaceSettings>): void;
  matchLinesAvailable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    /** @param event Outside pointer interaction closes the popover without stealing focus. */
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  return (
    <div
      className="env-picker"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        setOpen(false);
        trigger.current?.focus();
        event.preventDefault();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="env-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="env-symbol" aria-hidden="true">
          ⚙
        </span>
        <span>Settings</span>
      </button>
      {open && (
        <div id={id} className="env-menu settings-menu" role="dialog" aria-label="Settings">
          <p className="env-menu-heading">PREFERENCES</p>
          {toggles
            .filter((toggle) => toggle.key !== 'matchLines' || matchLinesAvailable)
            .map((toggle) => (
              <label className="settings-row" key={toggle.key}>
                <input
                  type="checkbox"
                  checked={settings[toggle.key]}
                  onChange={(event) => onChange({ [toggle.key]: event.target.checked })}
                />
                <span>
                  <strong>{toggle.label}</strong>
                  <small>{toggle.description}</small>
                </span>
              </label>
            ))}
          <label className="settings-row">
            <input
              className="settings-number"
              type="number"
              min={fontSizeRange.min}
              max={fontSizeRange.max}
              value={settings.fontSize}
              onChange={(event) => {
                if (event.target.value) onChange({ fontSize: Number(event.target.value) });
              }}
            />
            <span>
              <strong>Font size</strong>
              <small>
                Editor text size, {fontSizeRange.min}–{fontSizeRange.max} pixels
              </small>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
