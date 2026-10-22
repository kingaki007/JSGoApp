/** Wraps Monaco with shared defaults, semantic theming, and a public compilation handle. */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import MonacoEditor, { type Monaco } from '@monaco-editor/react';
import { languages, type Environment, type Language } from '@code-editor/core';
import './setup';
import { compileSource } from './compile';
import { applyEditorTheme, readEditorTypography, type EditorTheme } from './theme';

export interface CodeEditorHandle {
  /**
   * Compiles a source snapshot after the editor reports readiness.
   * @param source Complete source text to compile independently of subsequent edits.
   * @param language Language of the snapshot.
   */
  compile(source: string, language: Language): Promise<string>;
}

export interface CodeEditorProps {
  language: Language;
  environment?: Environment;
  path: string;
  value: string;
  theme: EditorTheme;
  /** @param value Complete edited text; an empty string is a valid draft. */
  onChange(value: string): void;
  /** Notifies the host when the editor and compilation handle are ready to use. */
  onReady?(): void;
  loading?: ReactNode;
}

/**
 * Renders a controlled editor while keeping source and project state in the host application.
 * @param props Editor language, model path, code, resolved theme, and host callbacks.
 * @param ref Receives the public compilation handle without exposing Monaco to the host.
 */
const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { language, environment = 'browser', path, value, theme, onChange, onReady, loading },
  ref,
) {
  const monacoRef = useRef<Monaco | null>(null);
  const environmentReady = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      /**
       * Compiles code through the mounted editor's language service.
       * @param source Source snapshot captured when execution was requested.
       * @param sourceLanguage Language used to interpret that snapshot.
       */
      async compile(source, sourceLanguage) {
        if (!monacoRef.current) throw new Error('The editor is not ready yet.');
        await environmentReady.current;
        return compileSource(monacoRef.current, source, sourceLanguage);
      },
    }),
    [],
  );

  useEffect(() => {
    if (monacoRef.current) applyEditorTheme(monacoRef.current, theme);
  }, [theme, ready]);

  useEffect(() => {
    let current = true;
    if (ready)
      environmentReady.current = import('./environment').then(async ({ configureEnvironment }) => {
        if (current && monacoRef.current)
          await configureEnvironment(monacoRef.current, environment);
      });
    return () => {
      current = false;
    };
  }, [environment, ready]);

  return (
    <MonacoEditor
      height="100%"
      theme="jsgoapp"
      beforeMount={(monaco) => applyEditorTheme(monaco, theme)}
      language={language}
      path={path}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      onMount={(editor, monaco) => {
        monacoRef.current = monaco;
        editor.updateOptions(readEditorTypography());
        setReady(true);
        onReady?.();
      }}
      loading={loading}
      options={{
        ariaLabel: `${languages[language].label} code editor`,
        automaticLayout: true,
        minimap: { enabled: false },
        padding: { top: 24, bottom: 24 },
        scrollBeyondLastLine: false,
        tabSize: 2,
        insertSpaces: true,
      }}
    />
  );
});

export default CodeEditor;
