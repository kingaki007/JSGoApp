/** Verifies console levels, the supported console methods, and untrusted level validation. */
import { describe, expect, it } from 'vitest';
import { createConsole, highestLevel, readLevel, type ConsoleLevel } from '../src/console';

/** Creates a console that records what it emits, with a clock the test controls. */
function fixture() {
  const entries: Array<[ConsoleLevel, unknown[]]> = [];
  let time = 0;
  const captured = createConsole(
    (level, values) => entries.push([level, values]),
    () => time,
  );
  return {
    captured,
    entries,
    /** @param milliseconds Time to add to the test clock. */
    advance(milliseconds: number) {
      time += milliseconds;
    },
  };
}

describe('captured console', () => {
  it('emits each logging method at its own level with its arguments', () => {
    const { captured, entries } = fixture();
    captured.log('a', 1);
    captured.info('b');
    captured.warn('c');
    captured.error('d');
    captured.debug('e');
    expect(entries).toEqual([
      ['log', ['a', 1]],
      ['info', ['b']],
      ['warn', ['c']],
      ['error', ['d']],
      ['debug', ['e']],
    ]);
  });

  it('supports dir, table, trace, and grouping without throwing', () => {
    const { captured, entries } = fixture();
    const value = { a: 1 };
    captured.dir(value, { depth: 2 });
    captured.table([value]);
    captured.trace('here');
    captured.group('Section');
    captured.groupCollapsed();
    captured.groupEnd();
    captured.clear();
    expect(entries).toEqual([
      ['log', [value]],
      ['log', [[value]]],
      ['debug', ['Trace:', 'here']],
      ['log', ['Section']],
    ]);
  });

  it('reports failed assertions as errors and stays silent for passing ones', () => {
    const { captured, entries } = fixture();
    captured.assert(true, 'not shown');
    captured.assert(false);
    captured.assert(0, 'value was', 0);
    expect(entries).toEqual([
      ['error', ['Assertion failed']],
      ['error', ['Assertion failed:', 'value was', 0]],
    ]);
  });

  it('counts per label and can reset a counter', () => {
    const { captured, entries } = fixture();
    captured.count();
    captured.count('clicks');
    captured.count();
    captured.countReset();
    captured.count();
    expect(entries.map(([, values]) => values[0])).toEqual([
      'default: 1',
      'clicks: 1',
      'default: 2',
      'default: 1',
    ]);
  });

  it('times labelled spans and warns about unknown timers', () => {
    const { captured, entries, advance } = fixture();
    captured.time('load');
    advance(12.345);
    captured.timeLog('load', 'halfway');
    advance(10);
    captured.timeEnd('load');
    captured.timeEnd('load');
    expect(entries).toEqual([
      ['log', ['load: 12.35 ms', 'halfway']],
      ['log', ['load: 22.34 ms']],
      ['warn', ["Timer 'load' does not exist"]],
    ]);
  });

  it('treats unknown levels as plain logs and ranks levels by severity', () => {
    expect(readLevel('warn')).toBe('warn');
    expect(readLevel('script')).toBe('log');
    expect(readLevel(undefined)).toBe('log');
    expect(highestLevel(['log', 'warn', 'info'])).toBe('warn');
    expect(highestLevel(['debug', 'error', 'warn'])).toBe('error');
    expect(highestLevel(['debug'])).toBe('debug');
    expect(highestLevel(['debug', 'log'])).toBe('log');
  });
});
