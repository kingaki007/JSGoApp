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
    expect(result.entries?.find((entry) => entry.key === 'secret')?.value.text).toBe('[Getter]');
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

  it('evaluates only explicitly requested getters, returns inspectable objects, and caches duplicate requests', () => {
    let calls = 0;
    let setters = 0;
    const value = {
      count: 42,
      get answer() {
        calls++;
        return { count: this.count };
      },
      set writeOnly(_value: unknown) {
        setters++;
      },
    };
    const inspector = createLiveInspector();
    const preview = inspector.inspect([value])![0];
    const entries = inspector.expand(preview.reference!).entries!;
    const getter = entries.find((entry) => entry.key === 'answer')!.value;
    expect(getter).toMatchObject({ text: '[Getter]', getter: expect.any(String) });
    expect(entries.find((entry) => entry.key === 'writeOnly')!.value).toEqual({
      type: 'function',
      text: '[Setter]',
    });
    expect(calls).toBe(0);
    expect(() => inspector.expand(getter.getter!)).toThrow();
    const result = inspector.evaluate(getter.getter!);
    expect(
      inspector.expand(result.reference!).entries?.find((entry) => entry.key === 'count')?.value
        .text,
    ).toBe('42');
    expect(inspector.evaluate(getter.getter!)).toEqual(result);
    expect(calls).toBe(1);
    expect(setters).toBe(0);
    expect(() => createLiveInspector().evaluate(getter.getter!)).toThrow('no longer available');
  });

  it('uses the inspected instance as the receiver of inherited getters', () => {
    class Example {
      constructor(private count: number) {}
      get answer() {
        return this.count;
      }
    }
    const inspector = createLiveInspector();
    const first = inspector.inspect([new Example(42)])![0];
    const second = inspector.inspect([new Example(99)])![0];
    /** @param reference Instance whose prototype getter should retain its receiver. */
    const evaluate = (reference: string) => {
      const prototype = inspector
        .expand(reference)
        .entries!.find((entry) => entry.key === '[[Prototype]]')!.value;
      const getter = inspector
        .expand(prototype.reference!)
        .entries!.find((entry) => entry.key === 'answer')!.value;
      return inspector.evaluate(getter.getter!).text;
    };
    expect(evaluate(first.reference!)).toBe('42');
    expect(evaluate(second.reference!)).toBe('99');
  });

  it('returns thrown getter errors inline and still permits inspecting other properties', () => {
    const inspector = createLiveInspector();
    const value = {
      get broken() {
        throw new Error('failed');
      },
      safe: 42,
    };
    const root = inspector.inspect([value])![0];
    const entries = inspector.expand(root.reference!).entries!;
    const getter = entries.find((entry) => entry.key === 'broken')!.value;
    expect(inspector.evaluate(getter.getter!)).toEqual({
      type: 'error',
      text: 'Getter threw: Error: failed',
    });
    expect(entries.find((entry) => entry.key === 'safe')?.value.text).toBe('42');
  });
});
