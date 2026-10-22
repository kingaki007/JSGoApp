/** Keeps cross-file definitions inside the scratchpad as read-only Monaco peek views. */
import type { Monaco } from '@monaco-editor/react';
import type { editor, IDisposable, Uri } from 'monaco-editor';

/**
 * Connects standalone Monaco navigation without replacing the editable draft model.
 * @param monaco Shared Monaco instance containing language providers and declaration models.
 * @param host Scratchpad editor that owns navigation and any nested peek editors.
 * @returns Subscription cleanup for editor unmount.
 */
export function configureNavigation(
  monaco: Monaco,
  host: editor.IStandaloneCodeEditor,
): IDisposable {
  const nestedSubscriptions = new Set<IDisposable>();

  const opener = monaco.editor.registerEditorOpener({
    /**
     * Shows external declarations through Monaco's definition peek action.
     * @param source Editor requesting navigation; other scratchpads keep their own handlers.
     * @param resource Definition URI supplied by the active language provider.
     */
    openCodeEditor(source: editor.ICodeEditor, resource: Uri) {
      if (source !== host || resource.toString() === host.getModel()?.uri.toString()) return false;
      host.trigger('jsgoapp', 'editor.action.peekDefinition', {});
      return true;
    },
  });
  const editorCreated = monaco.editor.onDidCreateEditor((nested: editor.ICodeEditor) => {
    if (nested === host) return;

    /** Prevents editing library declarations while keeping the scratchpad writable. */
    function protectDefinition() {
      const node = nested.getDomNode();
      if (node && host.getDomNode()?.contains(node)) nested.updateOptions({ readOnly: true });
    }

    const modelChanged = nested.onDidChangeModel(protectDefinition);
    const disposed = nested.onDidDispose(() => {
      modelChanged.dispose();
      disposed.dispose();
      nestedSubscriptions.delete(modelChanged);
      nestedSubscriptions.delete(disposed);
    });
    nestedSubscriptions.add(modelChanged);
    nestedSubscriptions.add(disposed);
    protectDefinition();
  });

  return {
    /** Unregisters navigation hooks when the owning scratchpad is unmounted. */
    dispose() {
      opener.dispose();
      editorCreated.dispose();
      for (const subscription of nestedSubscriptions) subscription.dispose();
      nestedSubscriptions.clear();
    },
  };
}
