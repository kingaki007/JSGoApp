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
  {
    key: 'confirmClose',
    label: 'Confirm close',
    description: 'Ask before closing a tab that has code in it',
  },
  {
    key: 'fontLigatures',
    label: 'Font ligatures',
    description: 'Render ligatures the editor font defines, such as => and !=',
  },
  {
    key: 'showInvisibles',
    label: 'Invisibles',
    description: 'Show spaces, tabs, and line endings in the editor',
  },
  {
    key: 'autoFormatOnRun',
    label: 'Auto-format on run',
    description: 'Format with Prettier immediately before every run',
  },
  {
    key: 'showSidebar',
    label: 'Sidebar',
    description: 'Show the scratchpad explorer sidebar',
  },
] as const;

/**
 * Renders the Settings trigger and its popover.
 * @param props.settings Current preferences.
 * @param props.onChange Receives only the changed preferences.
 * @param props.matchLinesAvailable Whether the account's plan includes line-aligned results.
 * @param props.codeFormattingAvailable Whether the account's plan includes code formatting.
 */
export default function SettingsPanel({
  settings,
  onChange,
  matchLinesAvailable,
  codeFormattingAvailable,
}: {
  settings: WorkspaceSettings;
  onChange(patch: Partial<WorkspaceSettings>): void;
  matchLinesAvailable: boolean;
  codeFormattingAvailable: boolean;
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
            .filter((toggle) => toggle.key !== 'autoFormatOnRun' || codeFormattingAvailable)
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
          <label className="settings-row">
            <select
              className="settings-select"
              value={settings.defaultEnvironment}
              onChange={(event) =>
                onChange({ defaultEnvironment: event.target.value as 'browser' | 'node' })
              }
            >
              <option value="browser">Browser</option>
              <option value="node">Node.js</option>
            </select>
            <span>
              <strong>Default environment</strong>
              <small>Execution environment a new session starts in</small>
            </span>
          </label>
          <label className="settings-row">
            <select
              className="settings-select"
              value={settings.defaultLanguage}
              onChange={(event) =>
                onChange({ defaultLanguage: event.target.value as 'javascript' | 'typescript' })
              }
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
            </select>
            <span>
              <strong>Default language</strong>
              <small>Language a new tab gets from Ctrl+T (Cmd+T)</small>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
