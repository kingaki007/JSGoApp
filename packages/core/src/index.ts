export type Language = 'javascript' | 'typescript';
export type Environment = 'browser' | 'node';

export const languages = {
  javascript: { label: 'JavaScript', extension: 'js' },
  typescript: { label: 'TypeScript', extension: 'ts' },
} satisfies Record<Language, { label: string; extension: string }>;

export interface ProjectFile {
  id: string;
  path: string;
  content: string;
  language: Language;
}

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  folders: string[];
  files: ProjectFile[];
  activeFileId: string;
  environment: Environment;
}

export interface RunRequest {
  id: string;
  code: string;
  environment: Environment;
}

export interface RunResult {
  id: string;
  lines: string[];
  error?: string;
}

export interface RuntimeAdapter {
  run(request: RunRequest): Promise<RunResult>;
  stop(): void;
}

export type Feature = 'cloudSave' | 'aiChat' | 'history';
export interface FeaturePolicy {
  mode: 'open' | 'paid';
  restricted: Feature[];
}

export function canUseFeature(
  policy: FeaturePolicy,
  feature: Feature,
  entitlements: Feature[],
): boolean {
  return (
    policy.mode === 'open' || !policy.restricted.includes(feature) || entitlements.includes(feature)
  );
}

export function createProject(): Project {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: 'Untitled playground',
    folders: ['src'],
    files: [
      {
        id: crypto.randomUUID(),
        path: 'src/main.ts',
        language: 'typescript',
        content:
          'const greeting: string = "Hello, playground";\nconsole.log(greeting);\n\nconst numbers = [1, 2, 3, 4];\nconsole.log(numbers.map(value => value * 2));\n',
      },
    ],
    activeFileId: '',
    environment: 'browser',
  };
}

// Imported projects and browser storage are untrusted input.
export function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Project>;
  return (
    p.schemaVersion === 1 &&
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.activeFileId === 'string' &&
    (p.environment === 'browser' || p.environment === 'node') &&
    Array.isArray(p.folders) &&
    p.folders.every((f) => typeof f === 'string') &&
    Array.isArray(p.files) &&
    p.files.length > 0 &&
    p.files.every(
      (f) =>
        f &&
        typeof f.id === 'string' &&
        typeof f.path === 'string' &&
        typeof f.content === 'string' &&
        (f.language === 'javascript' || f.language === 'typescript'),
    )
  );
}
