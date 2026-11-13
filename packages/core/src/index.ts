/** Defines shared language/project models, runtime contracts, and feature-access rules for all apps. */
export * from './features';
import type { ConsoleLevel } from './console';
import type { InspectedValue } from './inspect';
export type { ConsoleLevel } from './console';
export type { InspectedEntry, InspectedValue } from './inspect';
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
  /** Also reports expression statements that evaluate to undefined. */
  showUndefined?: boolean;
  /** Also sends expandable trees for objects, arrays, Maps, and Sets. */
  inspect?: boolean;
}

export interface RunResult {
  id: string;
  lines: string[];
  /** 1-based line of the executed code that produced each entry in lines; 0 when unknown. */
  sourceLines?: number[];
  /** Inspected arguments of each entry in lines; null when the text is the whole value. */
  details?: Array<InspectedValue[] | null>;
  /** Console level of each entry in lines; expression results count as plain logs. */
  levels?: ConsoleLevel[];
  error?: string;
}

/**
 * Receives one output entry, the 1-based executed-code line that produced it (0 when unknown),
 * its inspected arguments when the entry contains expandable values, and its console level.
 */
export type OutputListener = (
  line: string,
  sourceLine?: number,
  values?: InspectedValue[] | null,
  level?: ConsoleLevel,
) => void;

/** Result callback injected into instrumented code; `at` records a console call's line. */
export interface CaptureCallback {
  (value: unknown, line?: number): unknown;
  at(line: number): unknown;
  /** Called at the start of every loop iteration; throws when code runs too long without yielding. */
  tick(): void;
}

/**
 * Builds the callback used by every runtime so line tracking behaves identically in each host.
 * @param capturedConsole Console replacement returned to instrumented console calls.
 * @param setLine Records the line of the output that is about to be produced.
 * @param report Emits one automatic expression result.
 * @param showUndefined Whether undefined expression results are reported.
 * @param timeoutMs Optional limit on uninterrupted synchronous work, enforced from inside loops
 *   for hosts that cannot interrupt running code from outside. The clock restarts whenever the
 *   code yields to the event loop, so timers and animation frames may keep running indefinitely.
 *   Hosts that end the process themselves omit it.
 */
export function createCapture(
  capturedConsole: unknown,
  setLine: (line: number) => void,
  report: (value: unknown) => void,
  showUndefined = false,
  timeoutMs?: number,
): CaptureCallback {
  let ticks = 0;
  // Start of the current uninterrupted stretch of work; 0 once the event loop has run again.
  let busySince = 0;
  /** @param value Expression result, returned unchanged. @param line Its statement's first line. */
  const capture = (value: unknown, line = 0) => {
    if (value !== undefined || showUndefined) {
      setLine(line);
      report(value);
    }
    return value;
  };
  return Object.assign(capture, {
    /** @param line Line of the console call whose receiver is being resolved. */
    at(line: number) {
      setLine(line);
      return capturedConsole;
    },
    /** Checks the clock every 1024 iterations so the guard stays cheap in tight loops. */
    tick() {
      if (timeoutMs === undefined || (++ticks & 1023) !== 0) return;
      const now = Date.now();
      if (busySince === 0) {
        busySince = now;
        // A timer only fires after the current work yields, which ends the measured stretch.
        setTimeout(() => {
          busySince = 0;
        }, 0);
      } else if (now - busySince > timeoutMs) {
        throw new Error(`Execution exceeded ${Math.round(timeoutMs / 1000)} seconds.`);
      }
    },
  });
}

/** @param value Untrusted line number from another process; anything invalid becomes 0 (unknown). */
export function normalizeSourceLine(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 1_000_000
    ? value
    : 0;
}

export interface RuntimeAdapter {
  /** @param request Unique run identifier, compiled JavaScript, and target environment. */
  run(request: RunRequest, onOutput?: OutputListener): Promise<RunResult>;
  /** Cancels an active run and releases its execution resources. */
  stop(): void;
}

/** Creates a starter project with a TypeScript example and new project/file identifiers. */
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

/**
 * Checks the supported project schema before imported data is used by the application.
 * @param value Untrusted project data from storage or an imported file.
 */
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
