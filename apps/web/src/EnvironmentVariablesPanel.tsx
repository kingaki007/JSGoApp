/** Presents custom environment variables in a keyboard-dismissible popover anchored to the header. */
import { useEffect, useId, useRef, useState } from 'react';
import { envLimits } from './environmentVariables';

/**
 * Renders the Env vars trigger and its popover: existing variables with inline edit and remove,
 * and a row to add a new one.
 * @param props.vars Current variables, in insertion order.
 * @param props.onSet Adds or replaces one variable; invalid keys are ignored by the caller.
 * @param props.onRemove Removes one variable by name.
 */
export default function EnvironmentVariablesPanel({
  vars,
  onSet,
  onRemove,
}: {
  vars: Record<string, string>;
  onSet(key: string, value: string): void;
  onRemove(key: string): void;
}) {
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const names = Object.keys(vars);

  useEffect(() => {
    /** @param event Outside pointer interaction closes the popover without stealing focus. */
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  /** Adds the drafted variable and clears the add row, if the name is usable. */
  function addDrafted() {
    const key = newKey.trim();
    if (!key) return;
    onSet(key, newValue);
    setNewKey('');
    setNewValue('');
  }

  return (
    <div
      className="env-picker"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        setOpen(false);
        trigger.current?.focus();
        event.preventDefault();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="env-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="env-symbol" aria-hidden="true">
          ⚿
        </span>
        <span>Env vars</span>
        {names.length > 0 && <span className="envvar-count">{names.length}</span>}
      </button>
      {open && (
        <div
          id={id}
          className="env-menu envvar-menu"
          role="dialog"
          aria-label="Environment variables"
        >
          <p className="env-menu-heading">ENVIRONMENT VARIABLES</p>
          <p className="envvar-hint">
            Available in code as <code>process.env.NAME</code>, in both environments.
          </p>
          {names.length > 0 && (
            <div className="envvar-list">
              {names.map((key) => (
                <div className="envvar-row" key={key}>
                  <span className="envvar-key" title={key}>
                    {key}
                  </span>
                  <input
                    className="envvar-value-input"
                    aria-label={`Value for ${key}`}
                    value={vars[key]}
                    onChange={(event) => onSet(key, event.target.value)}
                  />
                  <button
                    type="button"
                    className="tab-action tab-close"
                    aria-label={`Remove ${key}`}
                    title="Remove"
                    onClick={() => onRemove(key)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="envvar-add-row">
            <input
              className="envvar-key-input"
              aria-label="New variable name"
              placeholder="NAME"
              maxLength={envLimits.keyLength}
              value={newKey}
              onChange={(event) => setNewKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addDrafted();
              }}
            />
            <input
              className="envvar-value-input"
              aria-label="New variable value"
              placeholder="value"
              value={newValue}
              onChange={(event) => setNewValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addDrafted();
              }}
            />
            <button
              type="button"
              className="text-button envvar-add"
              disabled={
                !newKey.trim() || (names.length >= envLimits.keys && !(newKey.trim() in vars))
              }
              onClick={addDrafted}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
