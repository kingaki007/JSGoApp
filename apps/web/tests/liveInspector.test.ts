/** Verifies deferred inspection, range navigation, deep objects, cycles, and getter safety. */
import { describe, expect, it } from 'vitest';
import { createLiveInspector } from '../src/liveInspector';

describe('live Browser inspector', () => {
  it('does not enumerate or read children until their branch is requested', () => {
    let keys = 0;
    let reads = 0;
    const target = Object.assign(
      Object.create(null),
      Object.fromEntries(Array.from({ length: 238 }, (_, i) => [`field${i}`, i])),
    );
    const value = new Proxy(target, {
      ownKeys(object) {
        keys++;
        return Reflect.ownKeys(object);
      },
      getOwnPropertyDescriptor(object, key) {
        reads++;
        return Reflect.getOwnPropertyDescriptor(object, key);
      },
    });
    const inspector = createLiveInspector();
    const preview = inspector.inspect([value])![0];
    expect(preview.entries).toBeUndefined();
    expect(keys).toBe(0);
    expect(reads).toBe(0);
    const groups = inspector.expand(preview.reference!);
    expect(groups.entries).toHaveLength(3);
    expect(keys).toBe(1);
    expect(reads).toBe(0);
    const last = inspector.expand(groups.entries![2].value.reference!);
    expect(last.entries).toHaveLength(38);
    expect(last.entries?.at(-1)).toEqual({
      key: 'field237',
      value: { type: 'number', text: '237' },
    });
    expect(reads).toBe(38);
    expect(last.omitted).toBeUndefined();
  });

  it('can navigate beyond five levels and follow cycles without recursive serialization', () => {
    const root: Record<string, unknown> = {};
    let current = root;
    for (let i = 0; i < 12; i++) {
      const child = {};
      current.child = child;
      current = child;
    }
    current.root = root;
    const inspector = createLiveInspector();
    const preview = inspector.inspect([root])![0];
    let reference = preview.reference!;
    for (let i = 0; i < 12; i++)
      reference = inspector.expand(reference).entries!.find((entry) => entry.key === 'child')!.value
        .reference!;
    expect(
      inspector.expand(reference).entries!.find((entry) => entry.key === 'root')!.value.reference,
    ).toBe(preview.reference);
  });

  it('reads updated data when expanded and never invokes custom getters or toJSON', () => {
    let calls = 0;
    const value = {
      count: 1,
      get secret() {
        calls++;
        return 42;
      },
      toJSON() {
        calls++;
        return {};
      },
    };
    const inspector = createLiveInspector();
    const reference = inspector.inspect([value])![0].reference!;
    value.count = 2;
    const result = inspector.expand(reference);
    expect(result.entries?.find((entry) => entry.key === 'count')?.value.text).toBe('2');
    expect(result.entries?.find((entry) => entry.key === 'secret')?.value.text).toBe(
      '[Getter/Setter]',
    );
    expect(calls).toBe(0);
  });

  it('keeps huge range responses bounded and rejects handles from other runs', () => {
    const inspector = createLiveInspector();
    const reference = inspector.inspect([new Array(20000).fill(1)])![0].reference!;
    const result = inspector.expand(reference);
    expect(result.entries!.length).toBeLessThanOrEqual(100);
    expect(result.entries!.every((entry) => entry.value.reference && !entry.value.entries)).toBe(
      true,
    );
    expect(() => createLiveInspector().expand(reference)).toThrow('no longer available');
  });
});
