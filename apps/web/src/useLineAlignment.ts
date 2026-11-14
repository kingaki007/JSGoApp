/** Computes whether results should align with editor lines, and the alignment data to do it. */
import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { CodeEditorHandle } from '@code-editor/editor';
import type { LineAlignment } from './OutputPanel';
import type { WorkspaceSettings } from './settings';

// Matches the workspace.css breakpoint below which the editor and results are stacked.
const sideBySideQuery = '(min-width: 1001px)';

/** Reports whether the editor and results are side by side, where aligning lines is meaningful. */
function useSideBySide(): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(sideBySideQuery).matches);
  useEffect(() => {
    const query = window.matchMedia(sideBySideQuery);
    /** Follows window resizing across the stacked-layout breakpoint. */
    const update = () => setMatches(query.matches);
    query.addEventListener('change', update);
    update();
    return () => query.removeEventListener('change', update);
  }, []);
  return matches;
}

interface LineAlignmentOptions {
  matchLinesEnabled: boolean;
  matchLinesPreferred: boolean;
  ready: boolean;
  fontSize: number;
  editorRef: RefObject<CodeEditorHandle | null>;
}

/**
 * @param options Plan/preference gates for aligning results with source lines, and the editor
 * handle to read line positions from.
 */
export function useLineAlignment({
  matchLinesEnabled,
  matchLinesPreferred,
  ready,
  fontSize,
  editorRef,
}: LineAlignmentOptions) {
  const sideBySide = useSideBySide();
  const matchLines = matchLinesEnabled && matchLinesPreferred && sideBySide && ready;
  // Wrapping, typography, and layout change line spacing; editor scrolling does not.
  const [, setViewportRevision] = useState(0);
  const onViewportChange = useCallback(() => setViewportRevision((revision) => revision + 1), []);
  const lineHeight = matchLines ? editorRef.current?.lineHeight() : null;
  const alignment: LineAlignment | undefined = lineHeight
    ? {
        lineTop: (line) => editorRef.current?.lineTop(line) ?? null,
        lineHeight,
        fontSize,
      }
    : undefined;
  return { matchLines, alignment, onViewportChange };
}
