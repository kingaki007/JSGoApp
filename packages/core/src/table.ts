/** Turns `console.table` data into a bounded grid of text cells that the results pane can render. */
import { inspectValues, summarize, type InspectedValue, type TableData } from './inspect';

export const tableLimits = { rows: 50, columns: 12, cell: 80 } as const;
const indexColumn = '(index)';
const valuesColumn = 'Values';

/**
 * Describes one cell without running user code: getters are named, not invoked.
 * @param owner Row object the cell belongs to. @param key Property to read.
 */
function cellOf(owner: object, key: string): string {
  const descriptor = Object.getOwnPropertyDescriptor(owner, key);
  if (!descriptor) return '';
  return 'value' in descriptor ? cellText(descriptor.value) : '[Getter]';
}

/** @param value Any cell value. @returns Short display text; nested values are summarized. */
function cellText(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, tableLimits.cell);
  const inspected = inspectValues([value], { depth: 2, entries: 5, nodes: 16, text: 40 })[0];
  return summarize(inspected, true).slice(0, tableLimits.cell);
}

/**
 * Lists the rows of tabular data as index labels with their values.
 * @param data Array, Map, Set, or plain object given to `console.table`.
 */
function rowsOf(data: object): Array<[string, unknown]> {
  if (Array.isArray(data)) return data.map((value, index) => [String(index), value]);
  if (data instanceof Map) return [...data.entries()].map(([key, value]) => [cellText(key), value]);
  if (data instanceof Set) return [...data.values()].map((value, index) => [String(index), value]);
  return Object.keys(data).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(data, key);
    return [key, descriptor && 'value' in descriptor ? descriptor.value : '[Getter]'];
  });
}

/**
 * Builds the grid for `console.table(data, columns)`.
 * @param data Value passed to `console.table`; only objects and collections are tabular.
 * @param only Optional list of column names to keep, as in the browser API.
 * @returns The grid, or null when the data is not tabular and should be logged normally.
 */
export function buildTable(data: unknown, only?: unknown): TableData | null {
  if (data === null || typeof data !== 'object') return null;
  let entries: Array<[string, unknown]>;
  try {
    entries = rowsOf(data);
  } catch {
    return null;
  }
  const shown = entries.slice(0, tableLimits.rows);
  const filter = Array.isArray(only) ? only.map(String) : null;
  const columns: string[] = [];
  let hasValues = false;
  for (const [, value] of shown) {
    if (value === null || typeof value !== 'object') {
      hasValues = true;
      continue;
    }
    for (const key of Object.keys(value))
      if (!columns.includes(key) && (!filter || filter.includes(key))) columns.push(key);
  }
  const kept = columns.slice(0, tableLimits.columns);
  const header = [indexColumn, ...kept, ...(hasValues && !filter ? [valuesColumn] : [])];
  const rows = shown.map(([index, value]) => {
    const isRow = value !== null && typeof value === 'object';
    return [
      index.slice(0, tableLimits.cell),
      ...kept.map((key) => (isRow ? cellOf(value, key) : '')),
      ...(hasValues && !filter ? [isRow ? '' : cellText(value)] : []),
    ];
  });
  return {
    columns: header,
    rows,
    ...(entries.length > shown.length ? { omitted: entries.length - shown.length } : {}),
  };
}

/** @param table Built grid. @returns Plain-text form used where tables are not rendered. */
export function tableText(table: TableData): string {
  return [table.columns, ...table.rows].map((row) => row.join(' | ')).join('\n');
}

/**
 * Creates the per-run table builder with one size budget, so tables cannot flood the host.
 * @param budget Characters of table cells allowed across the whole run.
 * @returns Function giving a table's inspected value and text, or null to log the data normally.
 */
export function createTableBuilder(budget = 200_000) {
  let remaining = budget;
  /** @param data Value passed to `console.table`. @param only Optional column filter. */
  return (data: unknown, only?: unknown): { value: InspectedValue; text: string } | null => {
    const table = buildTable(data, only);
    if (!table) return null;
    const text = tableText(table);
    if (text.length > remaining) return null;
    remaining -= text.length;
    const count = table.rows.length + (table.omitted ?? 0);
    return { value: { type: 'table', text: `Table(${count})`, table }, text };
  };
}
