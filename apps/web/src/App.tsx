/** Composes the header, explorer, shared editor, execution controls, and results pane. */
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
import AppHeader from './AppHeader';
import { useTheme } from './theme';
import EditorToolbar from './EditorToolbar';
import ResultsPane, { type ResultView } from './ResultsPane';
import TabList from './TabList';
import type { ScratchTab } from './draftStorage';
import { useExecution } from './useExecution';
import { useDrafts, tabTitle } from './useDrafts';
import { useAutoRun } from './useAutoRun';
import { useWorkbenchShortcuts } from './useWorkbenchShortcuts';
import { useLineAlignment } from './useLineAlignment';
import { useSettings } from './settings';
import { useEnvVars } from './environmentVariables';
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

// Labels the Run/Stop shortcuts with the platform's own modifier key.
const shortcutModifier = /Mac|iPhone|iPad/.test(navigator.userAgent) ? 'Cmd' : 'Ctrl';

/** @param props Optional API-owned account subject; anonymous visitors currently receive Max access. */
export default function App({ subject = anonymousSubject }: { subject?: AccessSubject }) {
  const features = resolveFeatureAccess(subject);
  const drafts = useDrafts(initialTabs, 'typescript');
  const { active } = drafts;
  const language: Language = active.language;
  const activeTitle = features.autoTabTitles ? tabTitle(active) : active.name;
  const { settings, update: updateSettings } = useSettings(features.workspaceSettings);
  const envVars = useEnvVars(features.environmentVariables);
  const [ready, setReady] = useState(false);
  const { themeId, setThemeId } = useTheme();
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const [environment, setEnvironment] = useState<Environment>(() => settings.defaultEnvironment);
  const [resultView, setResultView] = useState<ResultView>('console');
  // The Web view's container; the Browser page is created inside it while it exists.
  const [webMount, setWebMount] = useState<HTMLElement | null>(null);
  const webAvailable = features.webView && environment === 'browser';
  const execution = useExecution(
    active.id,
    language,
    active.code,
    environment,
    settings.showUndefined,
    features.objectInspection,
    webMount,
    envVars.vars,
  );
  /**
   * Runs the latest editor snapshot without coupling debounce timers to output-state renders.
   * Formatting first is cosmetic only, so running before or after its edit lands produces the
   * same output; no need to wait for the formatted text to reach React state.
   */
  const runCode = useCallback(() => {
    const triggerRun = () => void execution.run(editorRef.current);
    if (settings.autoFormatOnRun && features.codeFormatting)
      void editorRef.current?.format().then(triggerRun);
    else triggerRun();
  }, [execution.run, settings.autoFormatOnRun, features.codeFormatting]);
  const autoRun = useAutoRun({
    source: active.code,
    ready,
    enabled: settings.autoRun,
    run: runCode,
    cancelExecution: execution.cancelActive,
    clearOutput: execution.clear,
  });
  const { addTab, closeTab, clearActiveTab } = useWorkbenchShortcuts({
    features,
    settings,
    ready,
    activeTitle,
    drafts,
    autoRun,
  });

  // A page cannot move between containers, so showing or hiding the Web view starts a fresh run
  // in the new location. With Auto run off the user starts it, as for any other change.
  const lastMount = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (lastMount.current === webMount) return;
    lastMount.current = webMount;
    if (ready && settings.autoRun && active.code.trim()) autoRun.runNow();
  }, [webMount]);

  // Mark the failing line in the editor as well as in the results pane.
  const failure = execution.result?.status === 'error' ? execution.result : null;
  const errorMarker =
    features.errorLocations && failure?.errorLine
      ? { line: failure.errorLine, message: failure.error ?? '', id: failure.id }
      : null;

  const { matchLines, alignment, onViewportChange } = useLineAlignment({
    matchLinesEnabled: features.matchLines,
    matchLinesPreferred: settings.matchLines,
    ready,
    fontSize: settings.fontSize,
    editorRef,
  });

  return (
    <div className="workspace">
      <AppHeader
        environment={environment}
        showEnvVars={features.environmentVariables}
        vars={envVars.vars}
        onSetVar={envVars.set}
        onRemoveVar={envVars.remove}
        showSettings={features.workspaceSettings}
        settings={settings}
        onSettingsChange={updateSettings}
        matchLinesAvailable={features.matchLines}
        codeFormattingAvailable={features.codeFormatting}
        themeId={themeId}
        onThemeChange={setThemeId}
        premiumThemesAvailable={features.premiumThemes}
      />

      <aside className="sidebar" aria-label="Workspace">
        <p className="section-label">EXPLORER</p>
        <TabList
          tabs={drafts.tabs}
          activeId={active.id}
          editable={features.multipleTabs}
          canAdd={drafts.canAddTab}
          canReopen={features.reopenClosedTab && drafts.canReopenClosedTab}
          titleFromCode={features.autoTabTitles}
          onSelect={(id) => {
            if (id !== active.id) {
              autoRun.stop();
              drafts.selectTab(id);
            }
          }}
          onAdd={addTab}
          onReopen={drafts.reopenClosedTab}
          onClose={closeTab}
          onRename={drafts.renameTab}
        />
        <div className="sidebar-note">
          <span className="section-label">START SMALL. BUILD ANYTHING.</span>
          <p>A little space for your next idea.</p>
        </div>
      </aside>

      <main className="editor-panel">
        <EditorToolbar
          language={language}
          activeTitle={activeTitle}
          ready={ready}
          showFormat={features.codeFormatting}
          onFormat={() => void editorRef.current?.format()}
          showClear={features.clearEditor}
          canClear={ready && Boolean(active.code.trim())}
          onClear={clearActiveTab}
          environment={environment}
          onEnvironmentChange={(next) => {
            if (next !== environment) {
              autoRun.stop();
              setEnvironment(next);
            }
          }}
          isRunning={execution.isRunning}
          onRun={autoRun.runNow}
          onStop={autoRun.stop}
          showRunShortcuts={features.runShortcuts}
          shortcutModifier={shortcutModifier}
        />
        <div className="editor-breadcrumb">
          Scratchpads <span aria-hidden="true">/</span> {activeTitle}
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
            theme={themeId}
            language={language}
            environment={environment}
            path={`file:///${active.id}.${languages[language].extension}`}
            value={active.code}
            preferences={settings}
            errorMarker={errorMarker}
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
              ? 'Browser page · DOM available · Web view shows what it renders'
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
        view={resultView}
        onViewChange={setResultView}
        webAvailable={webAvailable}
        styleLevels={features.consoleLevels}
        locateErrors={features.errorLocations}
        showTables={features.consoleTable}
        copyOutput={features.copyOutput}
        onWebMount={setWebMount}
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
