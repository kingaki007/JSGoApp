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
import type { editor, IDisposable } from 'monaco-editor';
import { languages, type Environment, type Language, type FeatureAccess } from '@code-editor/core';
import './setup';
import { compileSource, type CompiledSource } from './compile';
import { registerFormatting } from './formatting';
import { configureNavigation } from './navigation';
import {
  configureLanguageFeatures,
  featureEditorOptions,
  closeRestrictedWidgets,
  registerFeatureProviders,
} from './features';
import { applyEditorTheme, readEditorTypography, type EditorTheme } from './theme';

export interface CodeEditorHandle {
  /**
   * Compiles a source snapshot after the editor reports readiness.
   * @param source Complete source text to compile independently of subsequent edits.
   * @param language Language of the snapshot.
   */
  compile(source: string, language: Language): Promise<CompiledSource>;
  /** Runs Format Document on the visible draft; resolves without changes when formatting is unavailable. */
  format(): Promise<void>;
  /**
   * Locates a draft line on screen so a host can align content beside it.
   * @param line 1-based line number in the visible draft.
   * @returns Viewport Y coordinate of the line's top edge, or null before the editor is ready.
   */
  lineTop(line: number): number | null;
  /** Height in pixels of one editor line, or null before the editor is ready. */
  lineHeight(): number | null;
}

export interface EditorPreferences {
  /** Editor font size in pixels. */
  fontSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
}

export interface CodeEditorProps {
  features: FeatureAccess;
  language: Language;
  environment?: Environment;
  path: string;
  value: string;
  theme: EditorTheme;
  /** @param value Complete edited text; an empty string is a valid draft. */
  onChange(value: string): void;
  /** Notifies the host when the editor and compilation handle are ready to use. */
  onReady?(): void;
  /** Reports scrolling, resizing, and line-layout changes that move lines on screen. */
  onViewportChange?(): void;
  /** Optional user preferences; token typography, no wrapping, and line numbers apply otherwise. */
  preferences?: EditorPreferences;
  loading?: ReactNode;
}

/**
 * Renders a controlled editor while keeping source and project state in the host application.
 * @param props Editor language, model path, code, resolved theme, and host callbacks.
 * @param ref Receives the public compilation handle without exposing Monaco to the host.
 */
const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  {
    features,
    language,
    environment = 'browser',
    path,
    value,
    theme,
    onChange,
    onReady,
    onViewportChange,
    preferences,
    loading,
  },
  ref,
) {
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const environmentReady = useRef<Promise<void>>(Promise.resolve());
  const [ready, setReady] = useState(false);
  const viewportListener = useRef(onViewportChange);
  viewportListener.current = onViewportChange;

  useEffect(() => {
    if (!ready || !monacoRef.current || !editorRef.current) return;
    let current = true;
    let providers: IDisposable | undefined;
    void registerFeatureProviders(monacoRef.current, features).then((registration) => {
      if (current) providers = registration;
      else registration.dispose();
    });
    closeRestrictedWidgets(editorRef.current, features);
    const navigation = features.definitionNavigation
      ? configureNavigation(monacoRef.current, editorRef.current)
      : undefined;
    return () => {
      current = false;
      providers?.dispose();
      navigation?.dispose();
    };
  }, [ready, features.definitionNavigation, features.autocomplete, features.hoverDocumentation]);

  useEffect(() => {
    if (!ready || !monacoRef.current || !features.codeFormatting) return;
    const formatting = registerFormatting(monacoRef.current);
    return () => formatting.dispose();
  }, [ready, features.codeFormatting]);

  useEffect(() => {
    if (!ready || !editorRef.current) return;
    editorRef.current.updateOptions({
      ...readEditorTypography(preferences?.fontSize),
      wordWrap: preferences?.wordWrap ? 'on' : 'off',
      lineNumbers: preferences?.lineNumbers === false ? 'off' : 'on',
    });
  }, [ready, preferences?.fontSize, preferences?.wordWrap, preferences?.lineNumbers]);

  useEffect(() => {
    const host = editorRef.current;
    if (!ready || !host) return;
    /** Forwards any change in on-screen line positions to the host. */
    const notify = () => viewportListener.current?.();
    const subscriptions = [
      host.onDidScrollChange(notify),
      host.onDidLayoutChange(notify),
      host.onDidContentSizeChange(notify),
      host.onDidChangeConfiguration(notify),
    ];
    notify();
    return () => {
      for (const subscription of subscriptions) subscription.dispose();
    };
  }, [ready]);

  useEffect(() => {
    if (!ready || !monacoRef.current) return;
    // Script drafts of one language share a global scope in the language service, so a hidden
    // tab's declarations would be reported as duplicates. Keep only the visible draft's model.
    for (const model of monacoRef.current.editor.getModels()) {
      const uri = model.uri.toString();
      if (
        uri !== path &&
        model.getLanguageId() === language &&
        /^file:\/\/\/[^/]+\.(js|ts)$/.test(uri)
      )
        model.dispose();
    }
  }, [ready, path, language]);

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
      /** Applies the registered formatter as one undoable edit. */
      async format() {
        await editorRef.current?.getAction('editor.action.formatDocument')?.run();
      },
      /** @param line 1-based draft line to locate in viewport coordinates. */
      lineTop(line) {
        const host = editorRef.current;
        const node = host?.getDomNode();
        if (!host || !node) return null;
        return (
          node.getBoundingClientRect().top + host.getTopForLineNumber(line) - host.getScrollTop()
        );
      },
      /** Reads the rendered line height, which follows the selected font size. */
      lineHeight() {
        return (
          editorRef.current?.getOption(monacoRef.current!.editor.EditorOption.lineHeight) ?? null
        );
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
      beforeMount={(monaco) => {
        applyEditorTheme(monaco, theme);
        configureLanguageFeatures(monaco);
      }}
      language={language}
      path={path}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      onMount={(editor, monaco) => {
        monacoRef.current = monaco;
        editorRef.current = editor;
        editor.updateOptions(readEditorTypography(preferences?.fontSize));
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
        ...featureEditorOptions(features),
      }}
    />
  );
});

export default CodeEditor;
