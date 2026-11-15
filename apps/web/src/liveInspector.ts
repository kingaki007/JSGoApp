/** Retains Browser values behind run-scoped handles and reads children only on expansion. */
import {
  inspectValues,
  summarize,
  type InspectedEntry,
  type InspectedValue,
} from '@code-editor/core/inspect';

const pageSize = 100;
interface Inventory {
  length: number;
  /** Reads only the requested slice; child composites remain handles. */
  read(start: number, end: number): InspectedEntry[];
}

/** Creates one inspection registry per sandbox run; destroying the frame releases all references. */
export function createLiveInspector() {
  const handles = new Map<string, () => InspectedValue>();
  const getters = new Map<string, () => InspectedValue>();
  const objects = new WeakMap<object, string>();
  let nextHandle = 0;

  /** @param read Deferred reader, called only after an explicit host request. */
  function retain(read: () => InspectedValue): string {
    const reference = String(++nextHandle);
    handles.set(reference, read);
    return reference;
  }

  /** @param getter Accessor captured during expansion. @param receiver Original inspected instance. */
  function retainGetter(getter: () => unknown, receiver: object): string {
    const handle = String(++nextHandle);
    let result: InspectedValue | undefined;
    getters.set(handle, () => {
      // Retries and duplicate transport requests must not repeat getter side effects.
      if (!result) {
        try {
          result = describe(getter.call(receiver));
        } catch (error) {
          result = {
            type: 'error',
            text: `Getter threw: ${summarize(describe(error))}`.slice(0, 2000),
          };
        }
      }
      return result;
    });
    return handle;
  }

  /** @param inventory Property inventory. @param start First index. @param end Exclusive last index. */
  function entries(inventory: Inventory, start: number, end: number): InspectedEntry[] {
    if (end - start <= pageSize) return inventory.read(start, end);
    let span = pageSize;
    while (Math.ceil((end - start) / span) > pageSize) span *= pageSize;
    const groups: InspectedEntry[] = [];
    for (let first = start; first < end; first += span) {
      const last = Math.min(end, first + span);
      const text = `Properties ${first} … ${last - 1}`;
      const reference = retain(() => ({
        type: 'object',
        text,
        entries: entries(inventory, first, last),
      }));
      groups.push({ key: text, value: { type: 'object', text, reference } });
    }
    return groups;
  }

  /** @param object Target whose own keys are enumerated now, but property values are read by range. */
  function inventory(object: object, receiver = object): Inventory {
    if (typeof Node !== 'undefined' && object instanceof Node) {
      const children = object.childNodes;
      return {
        length: children.length,
        read: (start, end) =>
          Array.from({ length: end - start }, (_, index) => ({
            key: String(start + index),
            value: describe(children[start + index]),
          })),
      };
    }
    if (object instanceof Map || object instanceof Set) {
      const isMap = object instanceof Map;
      return {
        length: object.size,
        read(start, end) {
          const result: InspectedEntry[] = [];
          let index = 0;
          for (const item of object.entries()) {
            if (index >= end) break;
            if (index >= start)
              result.push({
                key: String(index),
                value: describe(isMap ? { key: item[0], value: item[1] } : item[1]),
              });
            index++;
          }
          return result;
        },
      };
    }
    const keys = Reflect.ownKeys(object);
    const prototype = Object.getPrototypeOf(object);
    return {
      length: keys.length + (prototype === null ? 0 : 1),
      read: (start, end) =>
        Array.from({ length: end - start }, (_, index) => {
          const key = keys[start + index];
          if (key === undefined)
            return { key: '[[Prototype]]', value: describe(prototype, receiver) };
          let value: InspectedValue;
          try {
            const descriptor = Object.getOwnPropertyDescriptor(object, key);
            if (descriptor && 'value' in descriptor) value = describe(descriptor.value);
            else if (
              typeof window !== 'undefined' &&
              object === window &&
              descriptor?.get &&
              Function.prototype.toString.call(descriptor.get).includes('[native code]')
            ) {
              value = describe(descriptor.get.call(object));
            } else if (descriptor?.get)
              value = {
                type: 'function',
                text: descriptor.set ? '[Getter/Setter]' : '[Getter]',
                getter: retainGetter(descriptor.get, receiver),
              };
            else value = { type: 'function', text: descriptor?.set ? '[Setter]' : '[Deleted]' };
          } catch {
            value = { type: 'object', text: '[Uninspectable]' };
          }
          return { key: String(key).slice(0, 2000), value };
        }),
    };
  }

  /** @param value Console argument or one requested property; never traverses its child values. */
  function describe(value: unknown, receiver?: object): InspectedValue {
    try {
      if (value === null || typeof value !== 'object') return inspectValues([value])[0];
      if (value instanceof Date || value instanceof RegExp || value instanceof Promise) {
        return inspectValues([value])[0];
      }
      let type: InspectedValue['type'] = 'object';
      let text = 'Object';
      if (typeof Node !== 'undefined' && value instanceof Node) {
        const label = inspectValues([value], { depth: 0, entries: 0, nodes: 1, text: 2000 })[0];
        type = 'dom';
        text = label.text;
        // Element labels need attributes but no child traversal.
        if (value.nodeType === Node.ELEMENT_NODE) {
          const element = value as Element;
          text = `<${element.localName}${Array.from(element.attributes)
            .slice(0, 100)
            .map(
              (attribute) => ` ${attribute.name}=${JSON.stringify(attribute.value.slice(0, 2000))}`,
            )
            .join('')}>`.slice(0, 2000);
        }
      } else if (typeof window !== 'undefined' && value === window) text = 'Window';
      else if (Array.isArray(value) || ArrayBuffer.isView(value)) {
        type = 'array';
        const length = (value as unknown as { length?: number }).length ?? 0;
        text = `${Array.isArray(value) ? 'Array' : 'TypedArray'}(${length})`;
      } else if (value instanceof Map) {
        type = 'map';
        text = `Map(${value.size})`;
      } else if (value instanceof Set) {
        type = 'set';
        text = `Set(${value.size})`;
      } else if (value instanceof Error) {
        type = 'error';
        text = `${value.name}: ${value.message}`.slice(0, 2000);
      } else {
        const prototype = Object.getPrototypeOf(value);
        const constructor =
          prototype && Object.getOwnPropertyDescriptor(prototype, 'constructor')?.value;
        if (typeof constructor === 'function') text = constructor.name || 'Object';
      }
      let reference = receiver ? undefined : objects.get(value);
      if (!reference) {
        let properties: Inventory | undefined;
        reference = retain(() => {
          properties ??= inventory(value, receiver);
          return { type, text, entries: entries(properties, 0, properties.length) };
        });
        if (!receiver) objects.set(value, reference);
      }
      return { type, text, reference };
    } catch {
      return { type: 'object', text: '[Uninspectable]' };
    }
  }

  return {
    /** @param values Console arguments; initial output contains previews and handles only. */
    inspect(values: readonly unknown[]): InspectedValue[] | null {
      if (!values.some((value) => value !== null && typeof value === 'object')) return null;
      return values.slice(0, 50).map((value) => describe(value));
    },
    /** @param reference Handle owned by this run, including handles for property ranges. */
    expand(reference: string): InspectedValue {
      const read = handles.get(reference);
      if (!read) throw new Error('This value is no longer available. Run the code again.');
      return read();
    },
    /** @param handle Getter handle; this method is called only for an explicit evaluation request. */
    evaluate(handle: string): InspectedValue {
      const read = getters.get(handle);
      if (!read) throw new Error('This getter is no longer available. Run the code again.');
      return read();
    },
  };
}
