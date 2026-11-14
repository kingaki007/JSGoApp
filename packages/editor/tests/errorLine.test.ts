/** Verifies the error-line decoration options and that error text cannot be rendered as markup. */
import { describe, expect, it } from 'vitest';
import {
  errorLineClass,
  errorLineMarkerClass,
  errorLineOptions,
  escapeMarkdown,
} from '../src/errorLine';

describe('editor error line', () => {
  it('marks the whole line and its gutter with the host-styled classes', () => {
    const options = errorLineOptions({ line: 3, message: 'Something broke', id: 'run' });
    expect(options).toMatchObject({
      isWholeLine: true,
      className: errorLineClass,
      linesDecorationsClassName: errorLineMarkerClass,
      hoverMessage: { value: 'Something broke' },
    });
  });

  it('shows error text literally in the hover, without Markdown or HTML taking effect', () => {
    expect(escapeMarkdown('<img src=x> *bold* [link](http://x) `code`')).toBe(
      '\\<img src=x\\> \\*bold\\* \\[link\\]\\(http://x\\) \\`code\\`',
    );
    const options = errorLineOptions({ line: 1, message: '# heading', id: 'run' });
    expect(options.hoverMessage).toEqual({ value: '\\# heading' });
  });

  it('limits very long messages in the hover', () => {
    const options = errorLineOptions({ line: 1, message: 'x'.repeat(5000), id: 'run' });
    expect((options.hoverMessage as { value: string }).value).toHaveLength(1000);
  });
});
