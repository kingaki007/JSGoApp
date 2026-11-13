/** Builds the console given to snippets, so every runtime supports the same methods and levels. */

export type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

const levels: readonly ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];
// Higher numbers win when several entries share one line of the results pane.
const severity: Record<ConsoleLevel, number> = { debug: 0, log: 1, info: 2, warn: 3, error: 4 };

/** @param value Untrusted level from another process; anything unknown is treated as a plain log. */
export function readLevel(value: unknown): ConsoleLevel {
  return levels.includes(value as ConsoleLevel) ? (value as ConsoleLevel) : 'log';
}

/** @param entries Levels of the entries shown together. @returns The most severe of them. */
export function highestLevel(entries: readonly ConsoleLevel[]): ConsoleLevel {
  return entries.reduce<ConsoleLevel>(
    (highest, level) => (severity[level] > severity[highest] ? level : highest),
    'debug',
  );
}

export type CapturedConsole = Record<string, (...values: unknown[]) => void>;

/**
 * Creates a console whose output goes to the host instead of the real console.
 * Methods without a visual equivalent here (grouping, clearing) are accepted so common code runs.
 * @param emit Receives each entry's level and its arguments.
 * @param now Clock for `console.time`, replaceable in tests.
 */
export function createConsole(
  emit: (level: ConsoleLevel, values: unknown[]) => void,
  now: () => number = () => performance.now(),
): CapturedConsole {
  const counts = new Map<string, number>();
  const timers = new Map<string, number>();
  /** @param label Timer name. @param extra Values appended by `timeLog`. */
  const reportTimer = (label: string, extra: unknown[]) => {
    const started = timers.get(label);
    if (started === undefined) emit('warn', [`Timer '${label}' does not exist`]);
    else emit('log', [`${label}: ${(now() - started).toFixed(2)} ms`, ...extra]);
  };
  return {
    log: (...values) => emit('log', values),
    info: (...values) => emit('info', values),
    warn: (...values) => emit('warn', values),
    error: (...values) => emit('error', values),
    debug: (...values) => emit('debug', values),
    dir: (value) => emit('log', [value]),
    dirxml: (...values) => emit('log', values),
    table: (...values) => emit('log', values),
    trace: (...values) => emit('debug', ['Trace:', ...values]),
    /** @param condition Checked value. @param values Message shown only when the check fails. */
    assert: (condition, ...values) => {
      if (!condition)
        emit('error', values.length ? ['Assertion failed:', ...values] : ['Assertion failed']);
    },
    /** @param label Counter name; counters are independent per label. */
    count: (label = 'default') => {
      const next = (counts.get(String(label)) ?? 0) + 1;
      counts.set(String(label), next);
      emit('log', [`${String(label)}: ${next}`]);
    },
    countReset: (label = 'default') => void counts.delete(String(label)),
    time: (label = 'default') => void timers.set(String(label), now()),
    timeLog: (label = 'default', ...values) => reportTimer(String(label), values),
    /** @param label Timer to report and remove. */
    timeEnd: (label = 'default') => {
      reportTimer(String(label), []);
      timers.delete(String(label));
    },
    // Group labels are shown as ordinary entries; indentation is not represented.
    group: (...values) => {
      if (values.length) emit('log', values);
    },
    groupCollapsed: (...values) => {
      if (values.length) emit('log', values);
    },
    groupEnd: () => {},
    clear: () => {},
  };
}
