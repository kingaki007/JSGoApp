import { useId, type CSSProperties } from 'react';
import type { ThemePreference } from './theme';

const choices = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  return (
    <svg
      className="theme-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {theme === 'system' && (
        <>
          <rect x="3" y="4" width="18" height="13" rx="2" />
          <path d="M8 21h8m-4-4v4" />
        </>
      )}
      {theme === 'light' && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      )}
      {theme === 'dark' && <path d="M20.5 14.1A8.8 8.8 0 0 1 9.9 3.5a8.8 8.8 0 1 0 10.6 10.6Z" />}
    </svg>
  );
}

export default function ThemeSwitcher({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange(value: ThemePreference): void;
}) {
  const groupId = useId();
  return (
    <fieldset
      className="theme-switch"
      style={
        { '--theme-index': choices.findIndex((choice) => choice.value === value) } as CSSProperties
      }
    >
      <legend className="visually-hidden">Color theme</legend>
      <span className="theme-switch-indicator" aria-hidden="true" />
      {choices.map((choice) => (
        <label key={choice.value} className="theme-option" title={`${choice.label} theme`}>
          <input
            className="visually-hidden"
            type="radio"
            name={groupId}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
          />
          <span className="theme-option-content">
            <ThemeIcon theme={choice.value} />
            <span className="theme-option-label">{choice.label}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
