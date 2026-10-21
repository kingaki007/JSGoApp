import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import MonacoEditor, { type Monaco } from '@monaco-editor/react';
import { languages, type Language } from '@code-editor/core';
import './setup';
import { compileSource } from './compile';
import { applyEditorTheme, readEditorTypography, type EditorTheme } from './theme';

export interface CodeEditorHandle {
  compile(source: string, language: Language): Promise<string>;
}

export interface CodeEditorProps {
  language: Language;
  path: string;
  value: string;
  theme: EditorTheme;
  onChange(value: string): void;
  onReady?(): void;
  loading?: ReactNode;
}

// Keep Monaco's implementation details behind the application's editor API.
const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { language, path, value, theme, onChange, onReady, loading },
  ref,
) {
  const monacoRef = useRef<Monaco | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      async compile(source, sourceLanguage) {
        if (!monacoRef.current) throw new Error('The editor is not ready yet.');
        return compileSource(monacoRef.current, source, sourceLanguage);
      },
    }),
    [],
  );

  useEffect(() => {
    if (monacoRef.current) applyEditorTheme(monacoRef.current, theme);
  }, [theme, ready]);

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
