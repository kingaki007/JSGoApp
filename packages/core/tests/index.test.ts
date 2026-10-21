/** Verifies shared project validation and open/paid feature entitlement decisions. */
import { describe, expect, it } from 'vitest';
import { canUseFeature, createProject, isProject } from '../src/index';

describe('project persistence boundary', () => {
  it('accepts a serialized project and rejects malformed files', () => {
    const project = createProject();
    expect(isProject(JSON.parse(JSON.stringify(project)))).toBe(true);
    expect(isProject({ ...project, files: [{ path: 'oops' }] })).toBe(false);
    expect(isProject({ ...project, environment: 'shell' })).toBe(false);
  });
});

describe('feature policy', () => {
  it('opens all features in open mode and checks individual paid entitlements', () => {
    expect(canUseFeature({ mode: 'open', restricted: ['aiChat'] }, 'aiChat', [])).toBe(true);
    const policy = { mode: 'paid' as const, restricted: ['aiChat' as const] };
    expect(canUseFeature(policy, 'aiChat', [])).toBe(false);
    expect(canUseFeature(policy, 'aiChat', ['aiChat'])).toBe(true);
    expect(canUseFeature(policy, 'cloudSave', [])).toBe(true);
  });
});
