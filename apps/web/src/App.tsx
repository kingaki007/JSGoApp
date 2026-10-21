/** Composes the explorer, shared editor, execution controls, draft recovery, and results pane. */
import { useRef, useState } from 'react';
import { CodeEditor, type CodeEditorHandle } from '@code-editor/editor';
import { languages, type Language } from '@code-editor/core';
import { useTheme } from './theme';
import ThemeSwitcher from './ThemeSwitcher';
import ResultsPane from './ResultsPane';
import { useExecution, type BrowserTarget } from './useExecution';
import { useDrafts } from './useDrafts';

const initialDrafts: Record<Language, string> = {
  javascript:
    '// Your JavaScript scratchpad\nconst greeting = "Hello from JSGoApp";\nconsole.log(greeting);\n',
  typescript:
    '// Your TypeScript scratchpad\nconst message: string = "Hello from JSGoApp";\nconsole.log(message);\n',
};

/** Builds the browser workspace; application state stays outside the reusable editor package. */
export default function App() {
  const { language, drafts, setLanguage, updateDraft, saveState, saveMessage } =
    useDrafts(initialDrafts);
  const [ready, setReady] = useState(false);
  const { preference, setPreference, resolved } = useTheme();
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const [target, setTarget] = useState<BrowserTarget>('worker');
  const execution = useExecution(language, drafts[language], target);

  return (
    <div className="workspace">
      <header className="app-header">
        <a className="brand" href="#" aria-label="JSGoApp home">
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
            Browser environment
          </span>
          <ThemeSwitcher value={preference} onChange={setPreference} />
        </div>
      </header>

      <aside className="sidebar" aria-label="Workspace">
        <p className="section-label">EXPLORER</p>
        <div className="explorer-root">
          <span aria-hidden="true">⌄</span> SCRATCHPADS
        </div>
        <nav aria-label="Select language">
          {(Object.keys(languages) as Language[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`file-button ${language === id ? 'selected' : ''}`}
              aria-pressed={language === id}
              onClick={() => {
                if (id !== language) {
                  execution.stop();
                  setLanguage(id);
                }
              }}
            >
              <span className={`language-badge ${id}`} aria-hidden="true">
                {id === 'typescript' ? 'TS' : 'JS'}
              </span>
              scratch.{languages[id].extension}
            </button>
          ))}
        </nav>
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
              scratch.{languages[language].extension}
            </h1>
          </div>
          <div className="run-actions">
            {execution.isRunning ? (
              <button type="button" className="run-button stop-button" onClick={execution.stop}>
                <span aria-hidden="true">■</span> Stop
              </button>
            ) : (
              <button
                type="button"
                className="run-button"
                disabled={!ready}
                onClick={() => void execution.run(editorRef.current)}
              >
                <span aria-hidden="true">▶</span> Run
              </button>
            )}
          </div>
        </div>
        <div className="editor-breadcrumb">
          Scratchpads <span aria-hidden="true">/</span> scratch.{languages[language].extension}
          <label className="runtime-selector">
            <span className="visually-hidden">Browser execution</span>
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value as BrowserTarget)}
            >
              <option value="worker">Worker script</option>
              <option value="document">Web document</option>
            </select>
          </label>
        </div>
        <div className="editor-surface" aria-label={`${languages[language].label} code editor`}>
          <CodeEditor
            ref={editorRef}
            theme={resolved}
            language={language}
            path={`scratch.${languages[language].extension}`}
            value={drafts[language]}
            onChange={(value) => updateDraft(language, value)}
            onReady={() => setReady(true)}
            loading={<p className="editor-loading">Loading editor…</p>}
          />
        </div>
        <div className="draft-notice" role="note">
          <span
            className={`draft-save-state ${saveState === 'error' ? 'draft-save-error' : ''}`}
            role="status"
          >
            {saveMessage}
          </span>
        </div>
      </main>

      <ResultsPane
        environment="browser"
        result={execution.result}
        isRunning={execution.isRunning}
        onClear={execution.clear}
        previewRef={execution.attachPreview}
        onResetPreview={execution.stop}
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
