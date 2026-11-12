/** Verifies source-map decoding into draft line origins for emitted JavaScript. */
import { describe, expect, it } from 'vitest';
import { decodeLineMap } from '../src/sourceMap';

describe('compiler line map', () => {
  it('maps identical lines one to one', () => {
    // Three emitted lines, each starting at the next source line.
    expect(decodeLineMap('AAAA;AACA;AACA')).toEqual([1, 2, 3]);
  });

  it('follows skipped type-only lines and multiple segments per line', () => {
    // Line 1 → source 1 (two segments); line 2 → source 5 (+4); line 3 has no mapping.
    expect(decodeLineMap('AAAA,IAAI;AAIA;')).toEqual([1, 5, 0]);
  });

  it('decodes multi-digit and negative deltas', () => {
    // A +20 line delta is 'oB'; a -2 line delta is 'F'.
    expect(decodeLineMap('AAoBA;AAFA')).toEqual([21, 19]);
  });

  it('treats malformed segments as unmapped', () => {
    expect(decodeLineMap('!!!!;AACA')).toEqual([0, 2]);
    expect(decodeLineMap('')).toEqual([0]);
  });
});
