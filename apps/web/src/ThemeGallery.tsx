/** Presents RunJS's named editor themes as a keyboard-accessible, animated toolbar dropdown. */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { themeCatalog, type NamedTheme } from '@code-editor/editor';

/** @param props.theme Theme swatch to preview; its own background/foreground colors are reused. */
function ThemeSwatch({ theme }: { theme: NamedTheme }) {
  return (
    <span
      className="theme-swatch"
      aria-hidden="true"
      style={{
        background: theme.colors['editor.background'],
        color: theme.colors['editor.foreground'],
      }}
    >
      Aa
    </span>
  );
}

/**
 * @param props.themeId Currently selected theme id.
 * @param props.onChange Receives the newly selected theme id.
 * @param props.premiumUnlocked Whether the account's plan includes the 4 premium themes.
 */
export default function ThemeGallery({
  themeId,
  onChange,
  premiumUnlocked,
}: {
  themeId: string;
  onChange(themeId: string): void;
  premiumUnlocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choices = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const selected = themeCatalog.find((theme) => theme.id === themeId) ?? themeCatalog[0];
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
      const last = themeCatalog.length - 1;
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : current < 0
              ? themeCatalog.findIndex((theme) => theme.id === themeId)
              : Math.min(last, Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1)));
      setOpen(true);
      requestAnimationFrame(() => choices.current[next]?.focus());
    }
  }
  return (
    <div
      className="env-picker theme-gallery"
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
        aria-label={`Theme: ${selected.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <ThemeSwatch theme={selected} />
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
        <div id={id} className="env-menu theme-menu" role="listbox" aria-label="Theme">
          <p className="env-menu-heading">THEME</p>
          {themeCatalog.map((theme, index) => {
            const locked = theme.premium && !premiumUnlocked;
            return (
              <button
                key={theme.id}
                ref={(element) => {
                  choices.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={themeId === theme.id}
                disabled={locked}
                title={locked ? `${theme.label} (plan upgrade required)` : theme.label}
                onClick={() => {
                  if (locked) return;
                  onChange(theme.id);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <ThemeSwatch theme={theme} />
                <span>{theme.label}</span>
                {locked ? (
                  <span className="theme-lock" aria-hidden="true">
                    🔒
                  </span>
                ) : (
                  <span className="env-check" aria-hidden="true">
                    {themeId === theme.id ? '✓' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
