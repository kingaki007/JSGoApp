/** Renders the brand, environment status, and the Env vars/Settings/theme controls. */
import type { Environment } from '@code-editor/core';
import EnvironmentVariablesPanel from './EnvironmentVariablesPanel';
import SettingsPanel from './SettingsPanel';
import ThemeGallery from './ThemeGallery';
import type { WorkspaceSettings } from './settings';

interface AppHeaderProps {
  environment: Environment;
  /** Whether the Env vars control is shown for this plan. */
  showEnvVars: boolean;
  vars: Record<string, string>;
  onSetVar(key: string, value: string): void;
  onRemoveVar(key: string): void;
  /** Whether the Settings control is shown for this plan. */
  showSettings: boolean;
  settings: WorkspaceSettings;
  onSettingsChange(patch: Partial<WorkspaceSettings>): void;
  matchLinesAvailable: boolean;
  themeId: string;
  onThemeChange(themeId: string): void;
  /** Whether the account's plan includes the 4 premium themes. */
  premiumThemesAvailable: boolean;
}

/** @param props Environment status, the two optional popovers, and the theme switch. */
export default function AppHeader({
  environment,
  showEnvVars,
  vars,
  onSetVar,
  onRemoveVar,
  showSettings,
  settings,
  onSettingsChange,
  matchLinesAvailable,
  themeId,
  onThemeChange,
  premiumThemesAvailable,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      {/* The desktop app opens straight into the playground and has no separate home page to
          navigate to, so the logo is inert there instead of leaving the workbench. */}
      <a
        className="brand"
        href={window.desktop ? undefined : '/'}
        aria-label={window.desktop ? 'JSGoApp' : 'JSGoApp home'}
      >
        <span className="brand-mark" aria-hidden="true">
          JS
        </span>
        <span>
          JSGoApp<span className="brand-caption">PLAYGROUND</span>
        </span>
      </a>
      <div className="header-actions">
        <span className="environment-label">
          <span className="status-dot ready" />
          {environment === 'node' ? 'Node.js environment' : 'Browser environment'}
        </span>
        {showEnvVars && (
          <EnvironmentVariablesPanel vars={vars} onSet={onSetVar} onRemove={onRemoveVar} />
        )}
        {showSettings && (
          <SettingsPanel
            settings={settings}
            onChange={onSettingsChange}
            matchLinesAvailable={matchLinesAvailable}
          />
        )}
        <ThemeGallery
          themeId={themeId}
          onChange={onThemeChange}
          premiumUnlocked={premiumThemesAvailable}
        />
      </div>
    </header>
  );
}
