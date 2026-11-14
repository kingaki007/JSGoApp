/** Verifies table building for the shapes `console.table` accepts, its limits, and its validation. */
import { describe, expect, it } from 'vitest';
import { readInspectedValues } from '../src/inspect';
import { buildTable, createTableBuilder, tableLimits, tableText } from '../src/table';

describe('console.table data', () => {
  it('lays out an array of objects with the union of their keys', () => {
    expect(
      buildTable([
        { name: 'Ada', age: 36 },
        { name: 'Linus', city: 'Helsinki' },
      ]),
    ).toEqual({
      columns: ['(index)', 'name', 'age', 'city'],
      rows: [
        ['0', 'Ada', '36', ''],
        ['1', 'Linus', '', 'Helsinki'],
      ],
    });
  });

  it('puts primitive rows in a Values column and mixes them with object rows', () => {
    expect(buildTable(['a', 2, { x: true }])).toEqual({
      columns: ['(index)', 'x', 'Values'],
      rows: [
        ['0', '', 'a'],
        ['1', '', '2'],
        ['2', 'true', ''],
      ],
    });
  });

  it('uses keys as the index for plain objects, Maps, and Sets', () => {
    expect(buildTable({ first: { n: 1 }, second: { n: 2 } })?.rows).toEqual([
      ['first', '1'],
      ['second', '2'],
    ]);
    expect(buildTable(new Map([['k', { n: 1 }]]))?.rows).toEqual([['k', '1']]);
    expect(buildTable(new Set(['x']))).toEqual({
      columns: ['(index)', 'Values'],
      rows: [['0', 'x']],
    });
  });

  it('keeps only the requested columns', () => {
    expect(buildTable([{ a: 1, b: 2, c: 3 }], ['c', 'a'])).toEqual({
      columns: ['(index)', 'a', 'c'],
      rows: [['0', '1', '3']],
    });
  });

  it('summarizes nested values and names getters without invoking them', () => {
    let calls = 0;
    const row = {
      nested: { deep: [1, 2] },
      get lazy() {
        calls++;
        return 1;
      },
    };
    expect(buildTable([row])?.rows[0]).toEqual(['0', '{deep: Array(2)}', '[Getter]']);
    expect(calls).toBe(0);
  });

  it('limits rows, columns, and cell length, and reports omitted rows', () => {
    const wide = Object.fromEntries(
      Array.from({ length: 30 }, (_item, index) => [`c${index}`, index]),
    );
    const table = buildTable(
      Array.from({ length: 80 }, () => ({ ...wide, text: 'x'.repeat(500) })),
    );
    expect(table?.rows).toHaveLength(tableLimits.rows);
    expect(table?.omitted).toBe(30);
    expect(table?.columns).toHaveLength(tableLimits.columns + 1);
    expect(buildTable([{ text: 'x'.repeat(500) }])?.rows[0][1]).toHaveLength(tableLimits.cell);
  });

  it('treats non-tabular data as an ordinary value', () => {
    expect(buildTable('text')).toBeNull();
    expect(buildTable(42)).toBeNull();
    expect(buildTable(null)).toBeNull();
    expect(buildTable(undefined)).toBeNull();
  });

  it('provides a text form and stops building tables once the run budget is spent', () => {
    const table = buildTable([{ a: 1 }]);
    expect(tableText(table!)).toBe('(index) | a\n0 | 1');
    const build = createTableBuilder(40);
    const first = build([{ a: 1 }]);
    expect(first?.value).toMatchObject({ type: 'table', text: 'Table(1)' });
    expect(first?.text).toBe('(index) | a\n0 | 1');
    expect(build([{ a: 1 }])).not.toBeNull();
    expect(build([{ a: 1 }])).toBeNull();
    expect(build('text')).toBeNull();
  });

  it('accepts well-formed untrusted tables and rejects malformed ones', () => {
    const value = createTableBuilder()([{ a: 1 }, { a: 2 }])!.value;
    expect(readInspectedValues(JSON.parse(JSON.stringify([value])))).toEqual([value]);
    const broken = (table: unknown) =>
      readInspectedValues([{ type: 'table', text: 'Table(1)', table }]);
    expect(broken(undefined)).toBeNull();
    expect(broken({ columns: ['(index)'], rows: [['0', 'extra']] })).toBeNull();
    expect(broken({ columns: ['(index)', 'a'], rows: [['0', 5]] })).toBeNull();
    expect(broken({ columns: [], rows: [] })).toBeNull();
    expect(broken({ columns: ['a'], rows: Array.from({ length: 200 }, () => ['x']) })).toBeNull();
  });
});
