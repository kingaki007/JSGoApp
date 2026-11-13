/** Composes the explorer, shared editor, execution controls, draft recovery, and results pane. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CodeEditor, type CodeEditorHandle } from '@code-editor/editor';
import {
  languages,
  anonymousSubject,
  resolveFeatureAccess,
  type AccessSubject,
  type Environment,
  type Language,
} from '@code-editor/core';
import EnvironmentPicker from './EnvironmentPicker';
import { useTheme } from './theme';
import ThemeSwitcher from './ThemeSwitcher';
import ResultsPane from './ResultsPane';
import SettingsPanel from './SettingsPanel';
import TabList from './TabList';
import type { LineAlignment } from './OutputPanel';
import type { ScratchTab } from './draftStorage';
import { useExecution } from './useExecution';
import { useDrafts } from './useDrafts';
import { useAutoRun } from './useAutoRun';
import { useSettings } from './settings';
import './styles/workspace.css';

const initialTabs: ScratchTab[] = [
  {
    id: 'javascript',
    name: 'scratch.js',
    language: 'javascript',
    code: '// Your JavaScript scratchpad\nconst greeting = "Hello from JSGoApp";\nconsole.log(greeting);\n',
  },
  {
    id: 'typescript',
    name: 'scratch.ts',
    language: 'typescript',
    code: '// Your TypeScript scratchpad\nconst message: string = "Hello from JSGoApp";\nconsole.log(message);\n',
  },
];

// Matches the workspace.css breakpoint below which the editor and results are stacked.
const sideBySideQuery = '(min-width: 1001px)';

/** Reports whether the editor and results are side by side, where aligning lines is meaningful. */
function useSideBySide(): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(sideBySideQuery).matches);
  useEffect(() => {
    const query = window.matchMedia(sideBySideQuery);
    /** Follows window resizing across the stacked-layout breakpoint. */
    const update = () => setMatches(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);
  return matches;
}

/** @param props Optional API-owned account subject; anonymous visitors currently receive Max access. */
export default function App({ subject = anonymousSubject }: { subject?: AccessSubject }) {
  const features = resolveFeatureAccess(subject);
  const drafts = useDrafts(initialTabs, 'typescript');
  const { active } = drafts;
  const language: Language = active.language;
  const { settings, update: updateSettings } = useSettings(features.workspaceSettings);
  const [ready, setReady] = useState(false);
  const { preference, setPreference, resolved } = useTheme();
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const [environment, setEnvironment] = useState<Environment>('browser');
  const execution = useExecution(
    active.id,
    language,
    active.code,
    environment,
    settings.showUndefined,
    features.objectInspection,
  );
  /** Runs the latest editor snapshot without coupling debounce timers to output-state renders. */
  const runCode = useCallback(() => {
    void execution.run(editorRef.current);
  }, [execution.run]);
  const autoRun = useAutoRun({
    source: active.code,
    ready,
    enabled: settings.autoRun,
    run: runCode,
    cancelExecution: execution.cancelActive,
    clearOutput: execution.clear,
  });

  const sideBySide = useSideBySide();
  const matchLines = features.matchLines && settings.matchLines && sideBySide && ready;
  // Scrolling and layout changes move editor lines, so aligned results are re-rendered with them.
  const [, setViewportRevision] = useState(0);
  const onViewportChange = useCallback(() => setViewportRevision((revision) => revision + 1), []);
  const lineHeight = matchLines ? editorRef.current?.lineHeight() : null;
  const alignment: LineAlignment | undefined = lineHeight
    ? {
        lineTop: (line) => editorRef.current?.lineTop(line) ?? null,
        lineHeight,
        fontSize: settings.fontSize,
      }
    : undefined;

  return (
    <div className="workspace">
      <header className="app-header">
        <a className="brand" href="/" aria-label="JSGoApp home">
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
          {features.workspaceSettings && (
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              matchLinesAvailable={features.matchLines}
            />
          )}
          <ThemeSwitcher value={preference} onChange={setPreference} />
        </div>
      </header>

      <aside className="sidebar" aria-label="Workspace">
        <p className="section-label">EXPLORER</p>
        <TabList
          tabs={drafts.tabs}
          activeId={active.id}
          editable={features.multipleTabs}
          canAdd={drafts.canAddTab}
          onSelect={(id) => {
            if (id !== active.id) {
              autoRun.stop();
              drafts.selectTab(id);
            }
          }}
          onAdd={(next) => {
            autoRun.stop();
            drafts.addTab(next);
          }}
          onClose={(id) => {
            const tab = drafts.tabs.find((candidate) => candidate.id === id);
            // Closing discards the tab's code, so non-empty tabs need an explicit confirmation.
            if (tab?.code.trim() && !window.confirm(`Close ${tab.name} and discard its code?`))
              return;
            if (id === active.id) autoRun.stop();
            drafts.closeTab(id);
          }}
          onRename={drafts.renameTab}
        />
        <div className="sidebar-note">
          <span className="section-label">START SMALL. BUILD ANYTHING.</span>
          <p>A little space for your next idea.</p>
        </div>
      </aside>

      <main className="editor-panel">
        <div className="editor-toolbar">
          <div>
            <h1>
              <span className={`language-badge ${language}`} aria-hidden="true">
                {language === 'typescript' ? 'TS' : 'JS'}
              </span>{' '}
              {active.name}
            </h1>
          </div>
          <div className="run-actions">
            {features.codeFormatting && (
              <button
                type="button"
                className="run-button stop-button"
                disabled={!ready}
                title="Format with Prettier (Shift+Alt+F)"
                onClick={() => void editorRef.current?.format()}
              >
                Format
              </button>
            )}
            <EnvironmentPicker
              value={environment}
              onChange={(next) => {
                if (next !== environment) {
                  autoRun.stop();
                  setEnvironment(next);
                }
              }}
            />
            {execution.isRunning ? (
              <button type="button" className="run-button stop-button" onClick={autoRun.stop}>
                <span aria-hidden="true">■</span> Stop
              </button>
            ) : (
              <button
                type="button"
                className="run-button"
                disabled={!ready}
                onClick={autoRun.runNow}
              >
                <span aria-hidden="true">▶</span> Run
              </button>
            )}
          </div>
        </div>
        <div className="editor-breadcrumb">
          Scratchpads <span aria-hidden="true">/</span> {active.name}
          <label className="auto-run-toggle" title="Run 2 seconds after typing stops">
            <input
              type="checkbox"
              checked={settings.autoRun}
              onChange={(event) => updateSettings({ autoRun: event.target.checked })}
            />
            <span>Auto run</span>
            <span className="auto-run-delay">2s</span>
          </label>
        </div>
        <div className="editor-surface" aria-label={`${languages[language].label} code editor`}>
          <CodeEditor
            features={features}
            ref={editorRef}
            theme={resolved}
            language={language}
            environment={environment}
            path={`file:///${active.id}.${languages[language].extension}`}
            value={active.code}
            preferences={settings}
            onChange={(value) => drafts.updateCode(active.id, value)}
            onReady={() => setReady(true)}
            onViewportChange={matchLines ? onViewportChange : undefined}
            loading={<p className="editor-loading">Loading editor…</p>}
          />
        </div>
        <div className="draft-notice" role="note">
          <span
            className={`draft-save-state ${drafts.saveState === 'error' ? 'draft-save-error' : ''}`}
            role="status"
          >
            {drafts.saveMessage}
          </span>
          <span className="auto-run-status" role="status">
            {autoRun.isPending
              ? 'Waiting for typing to pause…'
              : settings.autoRun
                ? 'Auto run after 2 seconds idle'
                : 'Manual run'}
          </span>
          <span className="execution-hint">
            {environment === 'browser'
              ? 'Browser APIs · console execution · DOM preview deferred'
              : window.desktop
                ? 'Node.js · local desktop execution'
                : 'Node.js · local service required: pnpm dev:runner'}
          </span>
        </div>
      </main>

      <ResultsPane
        environment={environment}
        result={execution.result}
        isRunning={execution.isRunning}
        onClear={execution.clear}
        alignment={alignment}
      />

      <footer className="status-bar">
        <span role="status">
          <span className={`status-dot ${ready ? 'ready' : ''}`} />
          {ready ? 'Editor ready' : 'Starting editor'}
        </span>
        <span>
          {languages[language].label}
          <span className="status-divider">/</span>UTF-8
          <span className="status-divider">/</span>Spaces: 2
        </span>
      </footer>
    </div>
  );
}
