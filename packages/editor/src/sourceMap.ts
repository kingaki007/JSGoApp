/** Decodes compiler source maps into a per-line lookup from emitted JavaScript back to the draft. */
const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Reads the base64 VLQ numbers of one source-map segment.
 * @param segment Comma-free segment text such as `AAAA`.
 * @returns Signed field deltas in source-map order.
 */
function decodeSegment(segment: string): number[] {
  const fields: number[] = [];
  let value = 0;
  let shift = 0;
  for (const character of segment) {
    const digit = base64.indexOf(character);
    if (digit < 0) return [];
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      fields.push(value & 1 ? -(value >> 1) : value >> 1);
      value = 0;
      shift = 0;
    }
  }
  return fields;
}

/**
 * Maps each emitted line to the 1-based draft line of its first mapped token.
 * @param mappings The `mappings` field of a version 3 source map for a single source file.
 * @returns Entry `n - 1` is the draft line for emitted line `n`, or 0 when that line is unmapped.
 */
export function decodeLineMap(mappings: string): number[] {
  let sourceLine = 0;
  return mappings.split(';').map((line) => {
    let first = 0;
    for (const segment of line.split(',')) {
      const fields = decodeSegment(segment);
      if (fields.length < 4) continue;
      // Field 2 is the source-line delta, accumulated across the whole file.
      sourceLine += fields[2];
      if (!first) first = sourceLine + 1;
    }
    return first;
  });
}
