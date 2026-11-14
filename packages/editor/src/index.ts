/** Exposes the shared-editor API so applications do not depend on internal Monaco files. */
export { default as CodeEditor } from './CodeEditor';
export type { CodeEditorHandle, CodeEditorProps, EditorPreferences } from './CodeEditor';
export type { CompiledSource } from './compile';
export type { ErrorMarker } from './errorLine';
export type { EditorTheme } from './theme';
