/** Verifies value inspection limits, cycle and getter safety, previews, and untrusted-input validation. */
import { describe, expect, it } from 'vitest';
import {
  createInspector,
  inspectLimits,
  inspectValues,
  isComposite,
  readInspectedValues,
  summarize,
} from '../src/inspect';

/** @param value One value to inspect with the default limits. */
function inspectOne(value: unknown) {
  return inspectValues([value])[0];
}

describe('value inspection', () => {
  it('describes primitives, functions, dates, and regular expressions as leaves', () => {
    class Point {}
    expect(
      inspectValues([
        'text',
        42,
        true,
        undefined,
        null,
        10n,
        Symbol('id'),
        function named() {},
        Point,
        new Date('2026-01-02T03:04:05Z'),
        /a+/g,
      ]).map((value) => [value.type, value.text]),
    ).toEqual([
      ['string', 'text'],
      ['number', '42'],
      ['boolean', 'true'],
      ['undefined', 'undefined'],
      ['null', 'null'],
      ['bigint', '10n'],
      ['symbol', 'Symbol(id)'],
      ['function', 'ƒ named()'],
      ['function', 'class Point'],
      ['date', '2026-01-02T03:04:05.000Z'],
      ['regexp', '/a+/g'],
    ]);
  });

  it('expands objects, arrays, Maps, Sets, class instances, and errors', () => {
    class User {
      name = 'Ada';
    }
    expect(inspectOne({ a: 1, list: [true] })).toEqual({
      type: 'object',
      text: 'Object',
      entries: [
        { key: 'a', value: { type: 'number', text: '1' } },
        {
          key: 'list',
          value: {
            type: 'array',
            text: 'Array(1)',
            entries: [{ key: '0', value: { type: 'boolean', text: 'true' } }],
          },
        },
      ],
    });
    expect(inspectOne(new User()).text).toBe('User');
    expect(inspectOne(new Map([['k', 1]]))).toMatchObject({
      type: 'map',
      text: 'Map(1)',
      entries: [{ key: '"k"', value: { text: '1' } }],
    });
    expect(inspectOne(new Set(['x']))).toMatchObject({
      type: 'set',
      text: 'Set(1)',
      entries: [{ key: '0', value: { type: 'string', text: 'x' } }],
    });
    expect(inspectOne(new Uint8Array([7])).text).toBe('Uint8Array(1)');
    const error = inspectOne(new TypeError('bad'));
    expect(error).toMatchObject({ type: 'error', text: 'TypeError: bad' });
    expect(error.entries?.[0].key).toBe('stack');
    expect(inspectOne({})).toEqual({ type: 'object', text: 'Object', entries: [] });
  });

  it('marks cycles and reports getters without invoking them', () => {
    const cyclic: Record<string, unknown> = { name: 'loop' };
    cyclic.self = cyclic;
    expect(inspectOne(cyclic).entries?.[1].value).toEqual({ type: 'circular', text: '[Circular]' });
    let calls = 0;
    const guarded = {
      get secret() {
        calls++;
        return 1;
      },
    };
    expect(inspectOne(guarded).entries?.[0].value.text).toBe('[Getter]');
    expect(calls).toBe(0);
  });

  it('survives values that throw while being inspected', () => {
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error('no keys');
        },
      },
    );
    expect(inspectOne(hostile)).toEqual({ type: 'object', text: '[Uninspectable]' });
  });

  it('limits entries, depth, and total nodes and reports what was left out', () => {
    const wide = inspectOne(Array.from({ length: 250 }, (_item, index) => index));
    expect(wide.entries).toHaveLength(inspectLimits.entries);
    expect(wide.omitted).toBe(150);

    let deep: unknown = 'leaf';
    for (let level = 0; level < 10; level++) deep = { next: deep };
    let node = inspectOne(deep);
    let levels = 0;
    while (node.entries?.length) {
      node = node.entries[0].value;
      levels++;
    }
    expect(levels).toBe(inspectLimits.depth);
    expect(node).toEqual({ type: 'object', text: 'Object', omitted: 1 });

    const many = Array.from({ length: 20 }, () => Array.from({ length: 50 }, () => 0));
    const count = (value: ReturnType<typeof inspectOne>): number =>
      1 + (value.entries ?? []).reduce((sum, entry) => sum + count(entry.value), 0);
    expect(count(inspectOne(many))).toBeLessThanOrEqual(inspectLimits.nodes + 1);
  });

  it('summarizes collapsed composites on one line', () => {
    expect(summarize(inspectOne({ a: 1, b: 'x', c: [1, 2] }))).toBe('{a: 1, b: "x", c: Array(2)}');
    expect(summarize(inspectOne([1, 'two', null]))).toBe('Array(3) [1, "two", null]');
    expect(summarize(inspectOne(new Map([['k', 1]])))).toBe('Map(1) {"k": 1}');
    expect(summarize(inspectOne(Array.from({ length: 9 }, (_item, index) => index)))).toBe(
      'Array(9) [0, 1, 2, 3, 4, …]',
    );
    expect(summarize(inspectOne('top-level'))).toBe('top-level');
    expect(isComposite(inspectOne('text'))).toBe(false);
    expect(isComposite(inspectOne([]))).toBe(true);
  });

  it('inspects only when enabled, only for composite arguments, and within the run budget', () => {
    expect(createInspector(false)([{ a: 1 }])).toBeNull();
    const inspector = createInspector(true);
    expect(inspector(['text', 1, null])).toBeNull();
    expect(inspector(['label', { a: 1 }])).toHaveLength(2);
    const tight = createInspector(true, 150);
    expect(tight([{ a: 1 }])).not.toBeNull();
    expect(tight([{ a: 1 }])).toBeNull();
  });

  it('accepts well-formed untrusted values and rejects malformed ones', () => {
    const values = inspectValues([{ a: [1, 2] }, 'text']);
    expect(readInspectedValues(JSON.parse(JSON.stringify(values)))).toEqual(values);
    expect(readInspectedValues(undefined)).toBeNull();
    expect(readInspectedValues([])).toBeNull();
    expect(readInspectedValues([{ type: 'script', text: 'x' }])).toBeNull();
    expect(readInspectedValues([{ type: 'object', text: 1 }])).toBeNull();
    expect(
      readInspectedValues([{ type: 'object', text: 'Object', entries: [{ key: 1 }] }]),
    ).toBeNull();
    let nested: unknown = { type: 'string', text: 'leaf' };
    for (let level = 0; level < 20; level++)
      nested = { type: 'object', text: 'Object', entries: [{ key: 'next', value: nested }] };
    expect(readInspectedValues([nested])).toBeNull();
    // Unknown fields are dropped rather than passed to the UI.
    expect(readInspectedValues([{ type: 'number', text: '1', html: '<b>' }])).toEqual([
      { type: 'number', text: '1' },
    ]);
  });
});
