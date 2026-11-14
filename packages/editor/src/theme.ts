/** Resolves editor font settings from the host's shared typography tokens. */

/**
 * Resolves the host's rem-based font-size and line-height tokens into Monaco pixel settings.
 * @param preferredSize Optional user-selected size in pixels; the token size applies otherwise.
 */
export function readEditorTypography(preferredSize?: number) {
  const styles = getComputedStyle(document.documentElement);
  // Font-size primitives use rem; resolve them against the actual root size.
  const fontSize =
    preferredSize ??
    parseFloat(styles.fontSize) * parseFloat(styles.getPropertyValue('--font-size-body'));
  return {
    fontFamily: styles.getPropertyValue('--font-family-code').trim(),
    fontSize,
    lineHeight: Math.round(fontSize * parseFloat(styles.getPropertyValue('--line-height-code'))),
  };
}
