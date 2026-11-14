/** Validates, stores, and exposes custom environment variables shared by the web and desktop UI. */
import { useCallback, useState } from 'react';
import { envLimits, isValidEnvKey, readEnv } from '@code-editor/core/env';

export const envVarsStorageKey = 'jsgoapp.env';
export { envLimits, isValidEnvKey };

/** Loads saved environment variables; blocked or malformed storage yields none. */
export function loadEnvVars(): Record<string, string> {
  try {
    const raw = localStorage.getItem(envVarsStorageKey);
    if (raw === null) return {};
    const value: unknown = JSON.parse(raw);
    return readEnv((value as { variables?: unknown } | null)?.variables) ?? {};
  } catch {
    return {};
  }
}

/** @param vars Complete set of variables to store; failures keep the in-memory values. */
export function saveEnvVars(vars: Record<string, string>): void {
  try {
    localStorage.setItem(envVarsStorageKey, JSON.stringify({ version: 1, variables: vars }));
  } catch {
    // These are a convenience; the session continues with its in-memory values.
  }
}

/**
 * Holds custom environment variables for the session and persists them when the plan allows it.
 * @param persist Whether stored variables are restored and updated; the session starts empty otherwise.
 */
export function useEnvVars(persist: boolean) {
  const [vars, setVars] = useState<Record<string, string>>(() => (persist ? loadEnvVars() : {}));

  /** @param next Complete replacement set, already validated. */
  const commit = useCallback(
    (next: Record<string, string>) => {
      setVars(next);
      if (persist) saveEnvVars(next);
    },
    [persist],
  );

  return {
    vars,
    /**
     * Adds or replaces one variable.
     * @param key Variable name; ignored if it is not a safe identifier or the list is full.
     * @param value Variable value.
     */
    set(key: string, value: string) {
      const trimmed = key.trim();
      if (!isValidEnvKey(trimmed)) return;
      if (!(trimmed in vars) && Object.keys(vars).length >= envLimits.keys) return;
      if (value.length > envLimits.valueLength) return;
      commit({ ...vars, [trimmed]: value });
    },
    /** @param key Variable to remove. */
    remove(key: string) {
      if (!(key in vars)) return;
      const next = { ...vars };
      delete next[key];
      commit(next);
    },
  };
}
