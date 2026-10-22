/** Applies subscription access to language providers as well as visible editor controls. */
/// <reference path="./monacoAdapters.d.ts" />
import type { Monaco } from '@monaco-editor/react';
import type { editor, IDisposable, Uri } from 'monaco-editor';
import type { FeatureAccess } from '@code-editor/core';

/**
 * Reserves paid providers for our disposable registrations before Monaco initializes a language.
 * @param monaco Shared Monaco service; all editors in one app use the same account's access.
 */
export function configureLanguageFeatures(monaco: Monaco): void {
  for (const defaults of [
    monaco.typescript.typescriptDefaults,
    monaco.typescript.javascriptDefaults,
  ]) {
    const mode = defaults.modeConfiguration;
    if (
      mode.definitions === false &&
      mode.completionItems === false &&
      mode.hovers === false &&
      mode.signatureHelp === false
    )
      continue;
    defaults.setModeConfiguration({
      ...mode,
      definitions: false,
      completionItems: false,
      hovers: false,
      signatureHelp: false,
    });
  }
}

/**
 * Owns gated providers so revoking a plan disposes real shortcuts and language results immediately.
 * @param monaco Shared Monaco API, with built-in paid providers reserved during setup.
 * @param access Resolved feature access for the current app session.
 * @returns Cleanup for all registrations created for this access snapshot.
 */
export async function registerFeatureProviders(
  monaco: Monaco,
  access: FeatureAccess,
): Promise<IDisposable> {
  // Monaco 0.57's defaults setter does not re-register providers after language activation.
  // Reuse its pinned adapters rather than duplicating TypeScript completion/definition logic.
  const adapters = await import('monaco-editor/languages/features/typescript/tsMode.js');
  const registrations: IDisposable[] = [];
  for (const language of ['javascript', 'typescript'] as const) {
    /** @param resources Models to synchronize with the selected language's compiler worker. */
    const worker = async (...resources: Uri[]) => {
      const getWorker =
        language === 'typescript'
          ? await monaco.typescript.getTypeScriptWorker()
          : await monaco.typescript.getJavaScriptWorker();
      return getWorker(...resources);
    };
    if (access.definitionNavigation) {
      registrations.push(
        monaco.languages.registerDefinitionProvider(
          language,
          new adapters.DefinitionAdapter(new adapters.LibFiles(worker), worker),
        ),
      );
    }
    if (access.autocomplete) {
      registrations.push(
        monaco.languages.registerCompletionItemProvider(
          language,
          new adapters.SuggestAdapter(worker),
        ),
      );
    }
    if (access.hoverDocumentation) {
      registrations.push(
        monaco.languages.registerHoverProvider(language, new adapters.QuickInfoAdapter(worker)),
        monaco.languages.registerSignatureHelpProvider(
          language,
          new adapters.SignatureHelpAdapter(worker),
        ),
      );
    }
  }
  return {
    /** Revokes these providers without resetting compiler workers, models, or diagnostics. */
    dispose() {
      for (const registration of registrations) registration.dispose();
    },
  };
}

/**
 * Controls built-in editor fallbacks alongside JavaScript/TypeScript language providers.
 * @param access Resolved access for the current anonymous visitor or authenticated user.
 */
export function featureEditorOptions(
  access: FeatureAccess,
): editor.IStandaloneEditorConstructionOptions {
  return {
    definitionLinkOpensInPeek: access.definitionNavigation,
    quickSuggestions: access.autocomplete,
    suggestOnTriggerCharacters: access.autocomplete,
    wordBasedSuggestions: access.autocomplete ? 'matchingDocuments' : 'off',
    snippetSuggestions: access.autocomplete ? 'inline' : 'none',
    inlineSuggest: { enabled: access.autocomplete },
    suggest: { showWords: access.autocomplete, showSnippets: access.autocomplete },
    hover: { enabled: access.hoverDocumentation ? 'on' : 'off' },
    parameterHints: { enabled: access.hoverDocumentation },
  };
}

/**
 * Closes already open paid widgets immediately when access is revoked.
 * @param host Scratchpad editor whose open feature widgets must respect updated access.
 * @param access Latest resolved flags, including independent global off switches.
 */
export function closeRestrictedWidgets(host: editor.ICodeEditor, access: FeatureAccess): void {
  if (!access.definitionNavigation) host.trigger('feature-access', 'closeReferenceSearch', {});
  if (!access.autocomplete) host.trigger('feature-access', 'hideSuggestWidget', {});
  if (!access.hoverDocumentation) {
    host.trigger('feature-access', 'editor.action.hideHover', {});
    host.trigger('feature-access', 'closeParameterHints', {});
  }
}
