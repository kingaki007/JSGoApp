/** Verifies shared project validation at the persistence boundary. */
import { describe, expect, it } from 'vitest';
import { createProject, isProject } from '../src/index';

describe('project persistence boundary', () => {
  it('accepts a serialized project and rejects malformed files', () => {
    const project = createProject();
    expect(isProject(JSON.parse(JSON.stringify(project)))).toBe(true);
    expect(isProject({ ...project, files: [{ path: 'oops' }] })).toBe(false);
    expect(isProject({ ...project, environment: 'shell' })).toBe(false);
  });
});
