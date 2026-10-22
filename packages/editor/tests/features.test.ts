/** Checks that restricted plans remove language providers without breaking compilation or diagnostics. */
import { describe, expect, it, vi } from 'vitest';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { resolveFeatureAccess, type SubscriptionTier } from '@code-editor/core';
import {
  configureLanguageFeatures,
  featureEditorOptions,
  closeRestrictedWidgets,
  registerFeatureProviders,
} from '../src/features';

vi.mock('monaco-editor/languages/features/typescript/tsMode.js', () => {
  /** Stands in for Monaco's adapters; the tests exercise registration ownership, not TypeScript itself. */
  class Adapter {}
  return {
    LibFiles: Adapter,
    DefinitionAdapter: Adapter,
    SuggestAdapter: Adapter,
    QuickInfoAdapter: Adapter,
    SignatureHelpAdapter: Adapter,
  };
});

/** Models the two independent Monaco language services and preserves unrelated language settings. */
function languageServices() {
  /** Builds independent defaults so TypeScript and JavaScript cannot mask each other's settings. */
  const defaults = () => ({
    modeConfiguration: { diagnostics: true, documentRangeFormattingEdits: true },
    setModeConfiguration: vi.fn(),
    setCompilerOptions: vi.fn(),
  });
  const typescriptDefaults = defaults();
  const javascriptDefaults = defaults();
  const disposals: ReturnType<typeof vi.fn>[] = [];
  /** @param _language Registered language ID. @param _provider Disposable feature adapter. */
  function registration(_language: string, _provider: unknown) {
    const dispose = vi.fn();
    disposals.push(dispose);
    return { dispose };
  }
  const languages = {
    registerDefinitionProvider: vi.fn(registration),
    registerCompletionItemProvider: vi.fn(registration),
    registerHoverProvider: vi.fn(registration),
    registerSignatureHelpProvider: vi.fn(registration),
  };
  const monaco = {
    typescript: { typescriptDefaults, javascriptDefaults },
    languages,
  } as unknown as Monaco;
  return { monaco, services: [typescriptDefaults, javascriptDefaults], languages, disposals };
}

/** @param tier Account plan used to exercise the real shared access policy. */
function accessFor(tier: SubscriptionTier) {
  return resolveFeatureAccess({
    kind: 'authenticated',
    user: { id: 'test-user', subscription: { tier, status: 'active', expiresAt: null } },
  });
}

describe('editor subscription gates', () => {
  it('removes Free language providers and suggestion fallbacks while retaining diagnostics', () => {
    const { monaco, services } = languageServices();
    const access = accessFor('free');
    configureLanguageFeatures(monaco);
    for (const service of services) {
      expect(service.setModeConfiguration).toHaveBeenCalledWith({
        diagnostics: true,
        documentRangeFormattingEdits: true,
        definitions: false,
        completionItems: false,
        hovers: false,
        signatureHelp: false,
      });
      expect(service.setCompilerOptions).not.toHaveBeenCalled();
    }
    expect(featureEditorOptions(access)).toMatchObject({
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      wordBasedSuggestions: 'off',
      snippetSuggestions: 'none',
      inlineSuggest: { enabled: false },
      hover: { enabled: 'off' },
      parameterHints: { enabled: false },
    });
  });

  it('creates no paid providers for Free', async () => {
    const { monaco, languages } = languageServices();
    const registration = await registerFeatureProviders(monaco, accessFor('free'));
    for (const register of Object.values(languages)) expect(register).not.toHaveBeenCalled();
    registration.dispose();
  });

  it('owns and revokes Plus and Max providers for both languages', async () => {
    const { monaco, languages, disposals } = languageServices();
    const plus = await registerFeatureProviders(monaco, accessFor('plus'));
    expect(languages.registerDefinitionProvider).not.toHaveBeenCalled();
    for (const register of [
      languages.registerCompletionItemProvider,
      languages.registerHoverProvider,
      languages.registerSignatureHelpProvider,
    ]) {
      expect(register.mock.calls.map((call) => call[0])).toEqual(['javascript', 'typescript']);
    }
    plus.dispose();
    expect(disposals).toHaveLength(6);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();

    const max = await registerFeatureProviders(monaco, accessFor('max'));
    expect(languages.registerDefinitionProvider.mock.calls.map((call) => call[0])).toEqual([
      'javascript',
      'typescript',
    ]);
    max.dispose();
    expect(disposals).toHaveLength(14);
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledOnce();
  });

  it('dismisses open paid widgets when switching to Free', () => {
    const trigger = vi.fn();
    closeRestrictedWidgets({ trigger } as unknown as editor.ICodeEditor, accessFor('free'));
    expect(trigger.mock.calls.map((call) => call[1])).toEqual([
      'closeReferenceSearch',
      'hideSuggestWidget',
      'editor.action.hideHover',
      'closeParameterHints',
    ]);
  });
});
