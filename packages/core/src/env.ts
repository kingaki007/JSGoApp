/** Validates environment variables shared across the UI, both runtimes, and the wire protocol. */

export const envLimits = {
  keys: 50,
  keyLength: 100,
  valueLength: 10_000,
  totalLength: 50_000,
} as const;

// Matches shell/Node convention; also what `process.env.NAME` needs to be a valid identifier.
const keyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** @param key Candidate variable name. @returns Whether it is a safe, conventional identifier. */
export function isValidEnvKey(key: string): boolean {
  return key.length > 0 && key.length <= envLimits.keyLength && keyPattern.test(key);
}

/**
 * Validates a set of environment variables, from storage or from another process.
 * @param input Untrusted value. @returns A sanitized copy, or null when the shape is invalid.
 */
export function readEnv(input: unknown): Record<string, string> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const entries = Object.entries(input as Record<string, unknown>);
  if (entries.length > envLimits.keys) return null;
  const vars: Record<string, string> = {};
  let total = 0;
  for (const [key, value] of entries) {
    if (!isValidEnvKey(key) || typeof value !== 'string' || value.length > envLimits.valueLength)
      return null;
    total += key.length + value.length;
    if (total > envLimits.totalLength) return null;
    vars[key] = value;
  }
  return vars;
}
