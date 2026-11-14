/** Builds the editor decoration that marks the draft line where a run's error originated. */
import type { editor } from 'monaco-editor';

export interface ErrorMarker {
  /** 1-based draft line to mark. */
  line: number;
  /** Error text shown when the line is hovered. */
  message: string;
  /** Identifies the run, so a new run on the same line replaces a marker that edits have moved. */
  id: string;
}

/** Class names the host application styles; the editor package ships no stylesheet. */
export const errorLineClass = 'editor-error-line';
export const errorLineMarkerClass = 'editor-error-line-marker';

/**
 * Escapes text so Monaco's Markdown hover shows it literally.
 * @param text Error message, which may contain Markdown or HTML characters.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, '\\$&');
}

/**
 * Describes the whole-line highlight, its gutter marker, and its hover text.
 * @param marker Line and message of the error to mark.
 * @returns Decoration for `createDecorationsCollection`; the range is filled in by the caller.
 */
export function errorLineOptions(marker: ErrorMarker): editor.IModelDecorationOptions {
  return {
    isWholeLine: true,
    className: errorLineClass,
    linesDecorationsClassName: errorLineMarkerClass,
    // The decoration follows its line while the user edits around it.
    stickiness: 1,
    hoverMessage: { value: escapeMarkdown(marker.message.slice(0, 1000)) },
  };
}
