/** Presents the execution environment as a keyboard-accessible, animated toolbar dropdown. */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { Environment } from '@code-editor/core';

const options = [
  { value: 'browser', label: 'Browser', symbol: '◎', description: 'Browser APIs · console output' },
  { value: 'node', label: 'Node.js', symbol: '⬡', description: 'Node APIs · local execution' },
] as const;

/** @param props Selected environment and the callback that cancels execution before switching it. */
export default function EnvironmentPicker({
  value,
  onChange,
}: {
  value: Environment;
  onChange(value: Environment): void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choices = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const selected = options.find((option) => option.value === value)!;
  useEffect(() => {
    /** @param event Outside pointer interaction closes the dropdown without stealing focus. */
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  /** @param event Arrow keys navigate choices; Escape closes the popup and restores trigger focus. */
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      trigger.current?.focus();
      event.preventDefault();
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const current = choices.current.findIndex((element) => element === document.activeElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? 1
            : current < 0
              ? options.findIndex((option) => option.value === value)
              : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      setOpen(true);
      requestAnimationFrame(() => choices.current[next]?.focus());
    }
  }
  return (
    <div
      className="env-picker"
      ref={root}
      onKeyDown={navigate}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="env-trigger"
        aria-label={`Env: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="env-caption">Env</span>
        <span className="env-symbol" aria-hidden="true">
          {selected.symbol}
        </span>
        <span>{selected.label}</span>
        <svg
          className={open ? 'env-chevron expanded' : 'env-chevron'}
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div id={id} className="env-menu" role="listbox" aria-label="Env">
          <p className="env-menu-heading">EXECUTION ENVIRONMENT</p>
          {options.map((option, index) => (
            <button
              key={option.value}
              ref={(element) => {
                choices.current[index] = element;
              }}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span className="env-symbol" aria-hidden="true">
                {option.symbol}
              </span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
              <span className="env-check" aria-hidden="true">
                {value === option.value ? '✓' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
