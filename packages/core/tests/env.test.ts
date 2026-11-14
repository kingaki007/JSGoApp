/** Verifies environment-variable key rules and validation of untrusted variable sets. */
import { describe, expect, it } from 'vitest';
import { envLimits, isValidEnvKey, readEnv } from '../src/env';

describe('environment variable validation', () => {
  it('accepts conventional identifiers and rejects everything else', () => {
    expect(isValidEnvKey('API_KEY')).toBe(true);
    expect(isValidEnvKey('_PRIVATE')).toBe(true);
    expect(isValidEnvKey('a1')).toBe(true);
    expect(isValidEnvKey('')).toBe(false);
    expect(isValidEnvKey('1KEY')).toBe(false);
    expect(isValidEnvKey('API-KEY')).toBe(false);
    expect(isValidEnvKey('API KEY')).toBe(false);
    expect(isValidEnvKey('a'.repeat(envLimits.keyLength + 1))).toBe(false);
  });

  it('copies a well-formed set of string variables', () => {
    expect(readEnv({ API_KEY: 'abc', BASE_URL: 'https://example.com' })).toEqual({
      API_KEY: 'abc',
      BASE_URL: 'https://example.com',
    });
    expect(readEnv({})).toEqual({});
  });

  it('rejects malformed shapes, bad keys, non-string values, and oversized input', () => {
    expect(readEnv(undefined)).toBeNull();
    expect(readEnv(null)).toBeNull();
    expect(readEnv('text')).toBeNull();
    expect(readEnv(['a'])).toBeNull();
    expect(readEnv({ 'bad-key': 'x' })).toBeNull();
    expect(readEnv({ OK: 1 })).toBeNull();
    expect(readEnv({ OK: 'x'.repeat(envLimits.valueLength + 1) })).toBeNull();
    expect(
      readEnv(
        Object.fromEntries(Array.from({ length: envLimits.keys + 1 }, (_i, n) => [`K${n}`, 'v'])),
      ),
    ).toBeNull();
  });

  it('rejects a set whose combined size exceeds the total budget even if every entry is small', () => {
    const many = Object.fromEntries(
      Array.from({ length: envLimits.keys }, (_i, n) => [`K${n}`, 'x'.repeat(2000)]),
    );
    expect(readEnv(many)).toBeNull();
  });
});
