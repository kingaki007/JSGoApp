/** @vitest-environment happy-dom */
/** Verifies DOM snapshots survive transport and render as expandable markup. */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { inspectValues, readInspectedValues } from '@code-editor/core/inspect';
import ValueTree from '../src/ValueTree';
import { executeCode } from '../src/execution';

describe('browser value inspection', () => {
  it('captures document and element children as DOM trees rather than empty objects', async () => {
    const result = await executeCode(
      'dom',
      `
      const element = document.createElement('section');
      void element.setAttribute('id', 'demo');
      void (element.innerHTML = '<strong>Hello</strong><!--note-->');
      console.log(element);
      console.log(document);
    `,
      () => {},
      { inspect: true },
    );
    expect(result.error).toBeUndefined();
    expect(result.lines).toEqual(['<section id="demo">', '#document']);
    const value = result.details?.[0]?.[0];
    expect(value).toMatchObject({
      type: 'dom',
      text: '<section id="demo">',
      entries: [
        { value: { text: '<strong>', entries: [{ value: { text: '"Hello"' } }] } },
        { value: { text: '<!--note-->' } },
      ],
    });
    expect(readInspectedValues(JSON.parse(JSON.stringify([value])))).toEqual([value]);
    const markup = renderToStaticMarkup(<ValueTree value={value!} defaultOpen />);
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('&lt;strong&gt;');
    expect(markup).not.toContain('value-key');
  });

  it('bounds large DOM trees without invoking custom serialization hooks', () => {
    const element = document.createElement('div');
    element.innerHTML = '<span>child</span>'.repeat(150);
    Object.defineProperty(element, 'toJSON', {
      get() {
        throw new Error('must not read');
      },
    });
    const value = inspectValues([element])[0];
    expect(value.type).toBe('dom');
    expect(value.entries).toHaveLength(100);
    expect(value.omitted).toBe(50);
  });
});
