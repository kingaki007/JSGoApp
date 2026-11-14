/** Verifies environment-variable storage, recovery from malformed data, and the set/remove hook. */
// @vitest-environment happy-dom
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  envVarsStorageKey,
  loadEnvVars,
  saveEnvVars,
  useEnvVars,
} from '../src/environmentVariables';

let values: Map<string, string>;
let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

beforeEach(() => {
  values = new Map();
  storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

describe('environment variable storage', () => {
  it('treats a new profile as having no saved variables', () => {
    expect(loadEnvVars()).toEqual({});
  });

  it('round-trips a valid set of variables', () => {
    saveEnvVars({ API_KEY: 'abc', BASE_URL: 'https://example.com' });
    expect(loadEnvVars()).toEqual({ API_KEY: 'abc', BASE_URL: 'https://example.com' });
  });

  it('recovers to an empty set from malformed or invalid stored data', () => {
    values.set(envVarsStorageKey, '{broken');
    expect(loadEnvVars()).toEqual({});
    values.set(envVarsStorageKey, JSON.stringify({ version: 1, variables: { 'bad key': 'x' } }));
    expect(loadEnvVars()).toEqual({});
    values.set(envVarsStorageKey, JSON.stringify({ version: 1 }));
    expect(loadEnvVars()).toEqual({});
  });

  it('reports a failed write without throwing', () => {
    storage.setItem.mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(() => saveEnvVars({ A: 'b' })).not.toThrow();
  });
});

describe('useEnvVars', () => {
  let controls: ReturnType<typeof useEnvVars>;
  let root: Root;
  let container: HTMLDivElement;

  /** @param persist Whether the hook restores and saves variables from storage. */
  function Harness({ persist }: { persist: boolean }) {
    controls = useEnvVars(persist);
    return null;
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('adds, edits, and removes variables, persisting each change', () => {
    act(() =>
      root.render(
        <StrictMode>
          <Harness persist />
        </StrictMode>,
      ),
    );
    act(() => controls.set('API_KEY', 'first'));
    expect(controls.vars).toEqual({ API_KEY: 'first' });
    expect(loadEnvVars()).toEqual({ API_KEY: 'first' });
    act(() => controls.set('API_KEY', 'second'));
    expect(controls.vars).toEqual({ API_KEY: 'second' });
    act(() => controls.remove('API_KEY'));
    expect(controls.vars).toEqual({});
    expect(loadEnvVars()).toEqual({});
  });

  it('ignores an invalid key and a value past the length limit', () => {
    act(() =>
      root.render(
        <StrictMode>
          <Harness persist />
        </StrictMode>,
      ),
    );
    act(() => controls.set('bad key', 'x'));
    expect(controls.vars).toEqual({});
    act(() => controls.set('OK', 'x'.repeat(10_001)));
    expect(controls.vars).toEqual({});
  });

  it('does not persist across sessions when the plan does not allow it', () => {
    saveEnvVars({ EXISTING: 'value' });
    act(() =>
      root.render(
        <StrictMode>
          <Harness persist={false} />
        </StrictMode>,
      ),
    );
    expect(controls.vars).toEqual({});
    act(() => controls.set('NEW', 'value'));
    expect(controls.vars).toEqual({ NEW: 'value' });
    // The session's own addition, and the pre-existing stored variable, are both left on disk.
    expect(loadEnvVars()).toEqual({ EXISTING: 'value' });
  });
});
