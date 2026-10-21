import { describe, expect, it, vi } from 'vitest';
import { executeCode } from './execution';

describe('scratchpad execution', () => {
  it('streams logs and waits for explicitly awaited work', async () => {
    const output = vi.fn();
    const result = await executeCode(
      'run',
      'console.log("before"); await Promise.resolve(); console.log({ answer: 42 });',
      output,
    );
    expect(result).toEqual({ id: 'run', lines: ['before', '{"answer":42}'] });
    expect(output.mock.calls).toEqual([['before'], ['{"answer":42}']]);
  });

  it('keeps earlier output when execution throws', async () => {
    const result = await executeCode(
      'error',
      'console.log("started"); throw new Error("Something broke");',
      () => {},
    );
    expect(result.lines).toEqual(['started']);
    expect(result.error).toBe('Something broke');
  });

  it('reports malformed JavaScript without running it', async () => {
    const result = await executeCode('syntax', 'console.log("not reached"); const = ;', () => {});
    expect(result.lines).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it('bounds output and tells the user when logs are omitted', async () => {
    const result = await executeCode(
      'flood',
      'for (let i = 0; i < 1000; i++) console.log(i);',
      () => {},
    );
    expect(result.lines.length).toBeLessThanOrEqual(500);
    expect(result.lines.at(-1)).toContain('Output limit reached');
  });
});
