/** Renders an inspected value as text or as an expandable tree of its properties and items. */
import { useEffect, useState } from 'react';
import {
  isComposite,
  summarize,
  type InspectedValue,
  type TableData,
} from '@code-editor/core/inspect';

export type LoadInspectedValue = (reference: string) => Promise<InspectedValue>;

/**
 * Renders one value; composites start collapsed and load nothing until opened.
 * @param props.value Inspected value from a runtime, already validated.
 * @param props.name Property name or index when the value sits inside another value.
 * @param props.nested Whether the value is inside another value, where strings are quoted.
 * @param props.defaultOpen Whether a composite starts expanded, for a row the user just opened.
 * @param props.loadValue Requests children of a run-scoped Browser reference when opened.
 */
export default function ValueTree({
  value,
  name,
  nested = false,
  defaultOpen = false,
  loadValue,
}: {
  value: InspectedValue;
  name?: string;
  nested?: boolean;
  defaultOpen?: boolean;
  loadValue?: LoadInspectedValue;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [loaded, setLoaded] = useState<{ reference: string; value: InspectedValue }>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const reference = value.reference;
  const node = reference && loaded?.reference === reference ? loaded.value : value;
  useEffect(() => {
    if (!open || !reference || loaded?.reference === reference) return;
    let current = true;
    setError(undefined);
    if (!loadValue) {
      setError('This run is no longer available.');
      return;
    }
    void loadValue(reference).then(
      (value) => {
        if (current) setLoaded({ reference, value });
      },
      (reason) => {
        if (current)
          setError(reason instanceof Error ? reason.message : 'Could not inspect this value.');
      },
    );
    return () => {
      current = false;
    };
  }, [open, reference, loadValue, loaded?.reference, attempt]);
  if (value.type === 'table' && value.table) return <TableView table={value.table} />;
  const label = name === undefined ? null : <span className="value-key">{name}: </span>;

  if (!isComposite(value) || (!reference && !value.entries?.length)) {
    return (
      <span className="value-leaf">
        {label}
        <span className={`value value-${value.type}`}>{summarize(value, nested)}</span>
      </span>
    );
  }
  return (
    <span className="value-node">
      <button
        type="button"
        className="value-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="value-arrow" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
        {label}
        <span className={`value value-${value.type}`}>{open ? node.text : summarize(node)}</span>
      </button>
      {open && (
        <ul className="value-children">
          {node.entries?.map((entry, index) => (
            <li key={index}>
              <ValueTree
                value={entry.value}
                name={
                  value.type === 'dom' || entry.key === entry.value.text ? undefined : entry.key
                }
                nested
                loadValue={loadValue}
              />
            </li>
          ))}
          {reference && loaded?.reference !== reference && !error ? (
            <li role="status">Loading properties…</li>
          ) : null}
          {error ? (
            <li role="status">
              {error}{' '}
              <button
                type="button"
                className="value-toggle"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Retry
              </button>
            </li>
          ) : null}
          {node.entries?.length === 0 ? <li className="value-omitted">No properties</li> : null}
          {node.omitted ? <li className="value-omitted">… {node.omitted} more not shown</li> : null}
        </ul>
      )}
    </span>
  );
}

/**
 * Renders `console.table` data as a real table; every cell is plain text.
 * @param props.table Validated grid whose first column is the row index.
 */
export function TableView({ table }: { table: TableData }) {
  return (
    <span className="output-table-wrap">
      <table className="output-table">
        <thead>
          <tr>
            {table.columns.map((column, index) => (
              <th key={index} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {table.omitted ? (
        <span className="value-omitted">… {table.omitted} more rows not shown</span>
      ) : null}
    </span>
  );
}

/**
 * Renders the arguments of one output entry, separated like console arguments.
 * @param props.values Inspected console arguments or one expression result.
 * @param props.defaultOpen Whether composites start expanded.
 * @param props.loadValue Optional Browser branch loader shared by these arguments.
 */
export function ValueList({
  values,
  defaultOpen = false,
  loadValue,
}: {
  values: readonly InspectedValue[];
  defaultOpen?: boolean;
  loadValue?: LoadInspectedValue;
}) {
  return (
    <>
      {values.map((value, index) => (
        <span key={index}>
          {index > 0 && ' '}
          <ValueTree value={value} defaultOpen={defaultOpen} loadValue={loadValue} />
        </span>
      ))}
    </>
  );
}
