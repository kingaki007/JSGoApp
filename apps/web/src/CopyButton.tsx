/** Copies one output entry's raw text to the clipboard, with a brief visual confirmation. */
import { useEffect, useRef, useState } from 'react';

const confirmationMs = 1200;

/**
 * Writes text to the clipboard through the async Clipboard API.
 * @param text Text to copy.
 * @returns Whether the write is believed to have succeeded.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard access can be refused outside a secure context or without a user gesture;
    // there is nothing more to do than leave the entry uncopied.
    return false;
  }
}

/**
 * Renders a small copy action that confirms success without an extra live region per entry.
 * @param props.text Exact text this entry copies; already-truncated display text, not re-derived.
 * @param props.label Names what is being copied, for the accessible name and tooltip.
 */
export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return (
    <button
      type="button"
      className="copy-button"
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
      title={copied ? 'Copied' : 'Copy'}
      onClick={() => {
        void copyText(text).then((ok) => {
          if (!ok) return;
          if (timer.current) clearTimeout(timer.current);
          setCopied(true);
          timer.current = setTimeout(() => setCopied(false), confirmationMs);
        });
      }}
    >
      <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
    </button>
  );
}
