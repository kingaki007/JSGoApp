/** Renders an inspected value as text or as an expandable tree of its properties and items. */
import { useState } from 'react';
import { isComposite, summarize, type InspectedValue } from '@code-editor/core/inspect';

/**
 * Renders one value; composites start collapsed and load nothing until opened.
 * @param props.value Inspected value from a runtime, already validated.
 * @param props.name Property name or index when the value sits inside another value.
 * @param props.nested Whether the value is inside another value, where strings are quoted.
 * @param props.defaultOpen Whether a composite starts expanded, for a row the user just opened.
 */
export default function ValueTree({
  value,
  name,
  nested = false,
  defaultOpen = false,
}: {
  value: InspectedValue;
  name?: string;
  nested?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const label = name === undefined ? null : <span className="value-key">{name}: </span>;

  if (!isComposite(value) || !value.entries?.length) {
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
        <span className={`value value-${value.type}`}>{open ? value.text : summarize(value)}</span>
      </button>
      {open && (
        <ul className="value-children">
          {value.entries.map((entry, index) => (
            <li key={index}>
              <ValueTree value={entry.value} name={entry.key} nested />
            </li>
          ))}
          {value.omitted ? (
            <li className="value-omitted">… {value.omitted} more not shown</li>
          ) : null}
        </ul>
      )}
    </span>
  );
}

/**
 * Renders the arguments of one output entry, separated like console arguments.
 * @param props.values Inspected console arguments or one expression result.
 * @param props.defaultOpen Whether composites start expanded.
 */
export function ValueList({
  values,
  defaultOpen = false,
}: {
  values: readonly InspectedValue[];
  defaultOpen?: boolean;
}) {
  return (
    <>
      {values.map((value, index) => (
        <span key={index}>
          {index > 0 && ' '}
          <ValueTree value={value} defaultOpen={defaultOpen} />
        </span>
      ))}
    </>
  );
}
