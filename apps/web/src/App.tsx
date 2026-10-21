import { useRef, useState } from 'react';
import { CodeEditor, type CodeEditorHandle } from '@code-editor/editor';
import { languages, type Language } from '@code-editor/core';
import { useTheme } from './theme';
import ThemeSwitcher from './ThemeSwitcher';
import OutputPanel from './OutputPanel';
import { useExecution } from './useExecution';

const initialDrafts: Record<Language, string> = {
  javascript:
    '// Your JavaScript scratchpad\nconst greeting = "Hello from JSGoApp";\nconsole.log(greeting);\n',
  typescript:
    '// Your TypeScript scratchpad\nconst message: string = "Hello from JSGoApp";\nconsole.log(message);\n',
};

export default function App() {
  const [language, setLanguage] = useState<Language>('typescript');
  const [drafts, setDrafts] = useState(initialDrafts);
  const [ready, setReady] = useState(false);
  const { preference, setPreference, resolved } = useTheme();
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const execution = useExecution(language, drafts[language]);

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
          <span className="milestone">02 / RUN YOUR IDEAS</span>
          <ThemeSwitcher value={preference} onChange={setPreference} />
        </div>
      </header>

      <aside className="sidebar" aria-label="Workspace">
        <p className="section-label">SCRATCHPADS</p>
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
            <h1>{languages[language].label} scratchpad</h1>
            <p>Browser worker · {languages[language].label}</p>
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
        <div className="editor-surface" aria-label={`${languages[language].label} code editor`}>
          <CodeEditor
            ref={editorRef}
            theme={resolved}
            language={language}
            path={`scratch.${languages[language].extension}`}
            value={drafts[language]}
            onChange={(value) =>
              setDrafts((current) => ({
                ...current,
                [language]: value ?? '',
              }))
            }
            onReady={() => setReady(true)}
            loading={<p className="editor-loading">Loading editor…</p>}
          />
        </div>
        <OutputPanel
          result={execution.result}
          isRunning={execution.isRunning}
          onClear={execution.clear}
        />
        <div className="draft-notice" role="note">
          Runs locally in a Web Worker. No DOM, Node, or imports yet. Await async work explicitly.
          Refreshing clears drafts.
        </div>
      </main>

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
