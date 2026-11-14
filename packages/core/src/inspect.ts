/** Converts runtime values into bounded, serializable trees that the results pane can expand. */

export type InspectedType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'undefined'
  | 'null'
  | 'bigint'
  | 'symbol'
  | 'function'
  | 'date'
  | 'regexp'
  | 'promise'
  | 'error'
  | 'array'
  | 'map'
  | 'set'
  | 'object'
  | 'circular'
  | 'table';

export interface InspectedEntry {
  key: string;
  value: InspectedValue;
}

export interface InspectedValue {
  type: InspectedType;
  /** Leaf text, or a composite's label such as `Array(3)`, `Map(2)`, or a class name. */
  text: string;
  /** Children of a composite value; absent for leaves and for composites cut off by a limit. */
  entries?: InspectedEntry[];
  /** Number of children left out because of the entry, depth, or node limits. */
  omitted?: number;
  /** Grid of a `console.table` call; present only on values of type `table`. */
  table?: TableData;
}

export interface TableData {
  /** Column headers; the first is the row index. */
  columns: string[];
  /** One list of cell texts per row, as long as `columns`. */
  rows: string[][];
  /** Rows left out because of the row limit. */
  omitted?: number;
}

export interface InspectLimits {
  /** Composite nesting levels that keep their children. */
  depth: number;
  /** Children kept per composite. */
  entries: number;
  /** Total values kept per inspected argument list. */
  nodes: number;
  /** Characters kept per string leaf or key. */
  text: number;
}

export const inspectLimits: InspectLimits = { depth: 5, entries: 100, nodes: 300, text: 2000 };

const typeNames: readonly InspectedType[] = [
  'string',
  'number',
  'boolean',
  'undefined',
  'null',
  'bigint',
  'symbol',
  'function',
  'date',
  'regexp',
  'promise',
  'error',
  'array',
  'map',
  'set',
  'object',
  'circular',
  'table',
];

/**
 * Inspects console arguments together so one output entry shares a single node budget.
 * @param values Arguments of one console call, or a single expression result.
 * @param limits Size limits; the defaults keep one entry to a few tens of kilobytes.
 */
export function inspectValues(
  values: readonly unknown[],
  limits: InspectLimits = inspectLimits,
): InspectedValue[] {
  const budget = { nodes: limits.nodes };
  return values.map((value) => inspect(value, limits, budget, new Set(), 0));
}

/**
 * Creates the per-run inspector used by every runtime, with one shared size budget for the run.
 * @param enabled Whether the request asked for inspectable values.
 * @param runBudget Serialized characters allowed across the whole run.
 * @returns Function giving a console call's inspected arguments, or null when plain text suffices.
 */
export function createInspector(enabled: boolean, runBudget = 400_000) {
  let remaining = runBudget;
  /** @param values Console arguments or one expression result. */
  return (values: readonly unknown[]): InspectedValue[] | null => {
    // Primitive-only output is already complete as text.
    if (!enabled || remaining <= 0) return null;
    if (!values.some((value) => value !== null && typeof value === 'object')) return null;
    try {
      const inspected = inspectValues(values);
      const size = JSON.stringify(inspected).length;
      if (size > 60_000 || size > remaining) return null;
      remaining -= size;
      return inspected;
    } catch {
      return null;
    }
  };
}

/** @param value Inspected value. @returns Whether it can be expanded or was cut off by a limit. */
export function isComposite(value: InspectedValue): boolean {
  return value.entries !== undefined || value.omitted !== undefined;
}

/**
 * Builds the one-line preview shown beside a collapsed composite.
 * @param value Inspected value; leaves return their own text.
 * @param nested Whether the value sits inside another value, where strings are quoted.
 */
export function summarize(value: InspectedValue, nested = false): string {
  if (!value.entries) {
    if (value.type === 'string' && nested) return JSON.stringify(value.text);
    return value.omitted ? `${value.text} …` : value.text;
  }
  const parts: string[] = [];
  let length = 0;
  for (const entry of value.entries) {
    const child = entry.value.entries ? entry.value.text : summarize(entry.value, true);
    const part = value.type === 'array' || value.type === 'set' ? child : `${entry.key}: ${child}`;
    if (parts.length === 5 || length + part.length > 60) {
      parts.push('…');
      break;
    }
    parts.push(part);
    length += part.length;
  }
  if (value.omitted && parts.at(-1) !== '…') parts.push('…');
  const body = parts.join(', ');
  return value.type === 'array' || value.type === 'set'
    ? `${value.text} [${body}]`
    : `${value.text === 'Object' ? '' : `${value.text} `}{${body}}`;
}

/**
 * Validates inspected values received from another process before they reach the UI.
 * @param input Untrusted message field.
 * @returns Sanitized values, or null when the field is absent or malformed.
 */
export function readInspectedValues(input: unknown): InspectedValue[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50) return null;
  const budget = { nodes: inspectLimits.nodes * 2 };
  const values: InspectedValue[] = [];
  for (const item of input) {
    const value = readInspected(item, budget, 0);
    if (!value) return null;
    values.push(value);
  }
  return values;
}

/**
 * Validates an untrusted table: bounded size, text cells only, and rows as wide as the header.
 * @param input Untrusted `table` field of a value.
 */
function readTable(input: unknown): TableData | null {
  const table = input as { columns?: unknown; rows?: unknown; omitted?: unknown } | null;
  if (!table || typeof table !== 'object') return null;
  const { columns, rows } = table;
  /** @param cells Candidate row. @returns Whether it is a list of short strings. */
  const isRow = (cells: unknown): cells is string[] =>
    Array.isArray(cells) && cells.every((cell) => typeof cell === 'string' && cell.length <= 200);
  if (!isRow(columns) || columns.length === 0 || columns.length > 20) return null;
  if (!Array.isArray(rows) || rows.length > 100) return null;
  if (!rows.every((row) => isRow(row) && row.length === columns.length)) return null;
  const omitted = table.omitted;
  return {
    columns: [...columns],
    rows: rows.map((row: string[]) => [...row]),
    ...(typeof omitted === 'number' && Number.isInteger(omitted) && omitted > 0 ? { omitted } : {}),
  };
}

/**
 * Copies one untrusted node, keeping only known fields within the size limits.
 * @param input Untrusted node. @param budget Remaining nodes. @param depth Current nesting level.
 */
function readInspected(
  input: unknown,
  budget: { nodes: number },
  depth: number,
): InspectedValue | null {
  if (!input || typeof input !== 'object' || depth > inspectLimits.depth + 2) return null;
  if (--budget.nodes < 0) return null;
  const node = input as Record<string, unknown>;
  if (typeof node.text !== 'string' || !typeNames.includes(node.type as InspectedType)) return null;
  const value: InspectedValue = {
    type: node.type as InspectedType,
    text: node.text.slice(0, inspectLimits.text),
  };
  if (node.type === 'table') {
    const table = readTable(node.table);
    if (!table) return null;
    value.table = table;
  }
  if (typeof node.omitted === 'number' && Number.isInteger(node.omitted) && node.omitted > 0)
    value.omitted = node.omitted;
  if (node.entries !== undefined) {
    if (!Array.isArray(node.entries) || node.entries.length > inspectLimits.entries) return null;
    value.entries = [];
    for (const item of node.entries) {
      const entry = item as Record<string, unknown> | null;
      if (!entry || typeof entry !== 'object' || typeof entry.key !== 'string') return null;
      const child = readInspected(entry.value, budget, depth + 1);
      if (!child) return null;
      value.entries.push({ key: entry.key.slice(0, inspectLimits.text), value: child });
    }
  }
  return value;
}

/**
 * Inspects one value, guarding against cycles, getters, proxies, and oversized structures.
 * @param value Any runtime value.
 * @param limits Size limits.
 * @param budget Nodes still available to this argument list.
 * @param ancestors Composites on the current path, used to detect cycles.
 * @param depth Current nesting level; 0 for a console argument.
 */
function inspect(
  value: unknown,
  limits: InspectLimits,
  budget: { nodes: number },
  ancestors: Set<object>,
  depth: number,
): InspectedValue {
  budget.nodes--;
  if (value === null) return { type: 'null', text: 'null' };
  switch (typeof value) {
    case 'string':
      return { type: 'string', text: value.slice(0, limits.text) };
    case 'number':
    case 'boolean':
    case 'undefined':
      return { type: typeof value as InspectedType, text: String(value) };
    case 'bigint':
      return { type: 'bigint', text: `${value}n` };
    case 'symbol':
      return { type: 'symbol', text: value.toString().slice(0, limits.text) };
    case 'function': {
      const source = Function.prototype.toString.call(value);
      const name = value.name || 'anonymous';
      return {
        type: 'function',
        text: source.startsWith('class') ? `class ${name}` : `ƒ ${name}()`,
      };
    }
  }
  const object = value as object;
  try {
    if (ancestors.has(object)) return { type: 'circular', text: '[Circular]' };
    if (object instanceof Date)
      return {
        type: 'date',
        text: Number.isNaN(object.getTime()) ? 'Invalid Date' : object.toISOString(),
      };
    if (object instanceof RegExp)
      return { type: 'regexp', text: String(object).slice(0, limits.text) };
    if (object instanceof Promise) return { type: 'promise', text: 'Promise' };

    let type: InspectedType = 'object';
    let text: string;
    let pairs: Array<[string, () => unknown]>;
    if (Array.isArray(object) || ArrayBuffer.isView(object)) {
      const items = object as unknown as ArrayLike<unknown>;
      const length = typeof items.length === 'number' ? items.length : 0;
      type = 'array';
      text = `${Array.isArray(object) ? 'Array' : (object.constructor?.name ?? 'TypedArray')}(${length})`;
      pairs = Array.from({ length: Math.min(length, limits.entries + 1) }, (_item, index) => [
        String(index),
        () => items[index],
      ]);
      return composite(type, text, pairs, length, limits, budget, ancestors, depth, object);
    }
    if (object instanceof Map) {
      const entries = [...object.entries()].slice(0, limits.entries + 1);
      pairs = entries.map(([key, item]) => [keyText(key, limits), () => item]);
      return composite(
        'map',
        `Map(${object.size})`,
        pairs,
        object.size,
        limits,
        budget,
        ancestors,
        depth,
        object,
      );
    }
    if (object instanceof Set) {
      const items = [...object.values()].slice(0, limits.entries + 1);
      pairs = items.map((item, index) => [String(index), () => item]);
      return composite(
        'set',
        `Set(${object.size})`,
        pairs,
        object.size,
        limits,
        budget,
        ancestors,
        depth,
        object,
      );
    }
    const keys = Object.keys(object);
    pairs = keys.slice(0, limits.entries + 1).map((key) => [
      key.slice(0, limits.text),
      () => {
        // Getters are reported, not invoked, so inspecting never runs user code.
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        return descriptor && 'value' in descriptor ? descriptor.value : getterMarker;
      },
    ]);
    let total = keys.length;
    if (object instanceof Error) {
      type = 'error';
      text = `${object.name}: ${object.message}`.slice(0, limits.text);
      if (typeof object.stack === 'string') {
        pairs.unshift(['stack', () => object.stack]);
        total++;
      }
    } else {
      const prototype = Object.getPrototypeOf(object) as { constructor?: { name?: string } } | null;
      text = (prototype === null ? 'Object' : prototype.constructor?.name) || 'Object';
    }
    return composite(type, text, pairs, total, limits, budget, ancestors, depth, object);
  } catch {
    return { type: 'object', text: '[Uninspectable]' };
  }
}

const getterMarker = Symbol('getter');

/** @param key Map key of any type. @param limits Size limits. @returns Short display text for the key. */
function keyText(key: unknown, limits: InspectLimits): string {
  if (typeof key === 'string') return JSON.stringify(key.slice(0, limits.text));
  if (key !== null && (typeof key === 'object' || typeof key === 'function')) {
    return Array.isArray(key) ? `Array(${key.length})` : typeof key === 'function' ? 'ƒ' : 'Object';
  }
  return typeof key === 'bigint' ? `${key}n` : String(key).slice(0, limits.text);
}

/**
 * Inspects a composite's children until the depth, entry, or node limit is reached.
 * @param type Composite kind. @param text Its label. @param pairs Keys with lazy child readers.
 * @param total Real child count, used to report how many were left out.
 * @param limits Size limits. @param budget Remaining nodes. @param ancestors Current path.
 * @param depth Nesting level of this composite. @param object The composite itself.
 */
function composite(
  type: InspectedType,
  text: string,
  pairs: Array<[string, () => unknown]>,
  total: number,
  limits: InspectLimits,
  budget: { nodes: number },
  ancestors: Set<object>,
  depth: number,
  object: object,
): InspectedValue {
  if (total === 0) return { type, text, entries: [] };
  if (depth >= limits.depth || budget.nodes <= 0) return { type, text, omitted: total };
  const entries: InspectedEntry[] = [];
  ancestors.add(object);
  for (const [key, read] of pairs.slice(0, limits.entries)) {
    if (budget.nodes <= 0) break;
    const child = read();
    entries.push({
      key,
      value:
        child === getterMarker
          ? { type: 'function', text: '[Getter]' }
          : inspect(child, limits, budget, ancestors, depth + 1),
    });
  }
  ancestors.delete(object);
  return {
    type,
    text,
    entries,
    ...(total > entries.length ? { omitted: total - entries.length } : {}),
  };
}
