/** Renders the editor's title row: language badge, title, and the Format/Clear/Env/Run controls. */
import type { Environment, Language } from '@code-editor/core';
import EnvironmentPicker from './EnvironmentPicker';

interface EditorToolbarProps {
  language: Language;
  activeTitle: string;
  ready: boolean;
  /** Whether the Format button is shown for this plan. */
  showFormat: boolean;
  onFormat(): void;
  /** Whether the Clear button is shown for this plan. */
  showClear: boolean;
  /** False once the active tab has no code left to discard. */
  canClear: boolean;
  onClear(): void;
  environment: Environment;
  onEnvironmentChange(next: Environment): void;
  isRunning: boolean;
  onRun(): void;
  onStop(): void;
  /** Whether Run/Stop show their keyboard shortcut in the tooltip. */
  showRunShortcuts: boolean;
  /** Platform modifier key label ("Cmd" or "Ctrl") used in the Run/Stop tooltips. */
  shortcutModifier: string;
}

/** @param props Active tab identity, plan-gated toolbar buttons, and run state. */
export default function EditorToolbar({
  language,
  activeTitle,
  ready,
  showFormat,
  onFormat,
  showClear,
  canClear,
  onClear,
  environment,
  onEnvironmentChange,
  isRunning,
  onRun,
  onStop,
  showRunShortcuts,
  shortcutModifier,
}: EditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      <div>
        <h1>
          <span className={`language-badge ${language}`} aria-hidden="true">
            {language === 'typescript' ? 'TS' : 'JS'}
          </span>{' '}
          {activeTitle}
        </h1>
      </div>
      <div className="run-actions">
        {showFormat && (
          <button
            type="button"
            className="run-button stop-button"
            disabled={!ready}
            title="Format with Prettier (Shift+Alt+F)"
            onClick={onFormat}
          >
            Format
          </button>
        )}
        {showClear && (
          <button
            type="button"
            className="run-button stop-button"
            disabled={!canClear}
            title="Clear editor contents (Ctrl+Shift+K)"
            onClick={onClear}
          >
            Clear
          </button>
        )}
        <EnvironmentPicker value={environment} onChange={onEnvironmentChange} />
        {isRunning ? (
          <button
            type="button"
            className="run-button stop-button"
            title={showRunShortcuts ? `Stop (${shortcutModifier}+Shift+R)` : undefined}
            onClick={onStop}
          >
            <span aria-hidden="true">■</span> Stop
          </button>
        ) : (
          <button
            type="button"
            className="run-button"
            disabled={!ready}
            title={showRunShortcuts ? `Run (${shortcutModifier}+R)` : undefined}
            onClick={onRun}
          >
            <span aria-hidden="true">▶</span> Run
          </button>
        )}
      </div>
    </div>
  );
}
