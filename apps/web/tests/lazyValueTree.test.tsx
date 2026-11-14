/** Verifies that the results tree fetches only opened branches and reports unavailable runs. */
// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import ValueTree from '../src/ValueTree';
import type { InspectedValue } from '@code-editor/core';

it('requests each branch only when opened, caches it locally, and supports retry', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const load = vi
    .fn<(reference: string) => Promise<InspectedValue>>()
    .mockResolvedValueOnce({
      type: 'object',
      text: 'Object',
      entries: [{ key: 'child', value: { type: 'object', text: 'Object', reference: '2' } }],
    })
    .mockRejectedValueOnce(new Error('This run is no longer available.'))
    .mockResolvedValueOnce({
      type: 'object',
      text: 'Object',
      entries: [{ key: 'answer', value: { type: 'number', text: '42' } }],
    });
  /** @param index Visible toggle to click, then flush its asynchronous request. */
  const toggle = async (index: number) =>
    act(async () => {
      container.querySelectorAll<HTMLButtonElement>('button.value-toggle')[index].click();
      await Promise.resolve();
    });
  try {
    await act(async () =>
      root.render(
        <ValueTree value={{ type: 'object', text: 'Object', reference: '1' }} loadValue={load} />,
      ),
    );
    expect(load).not.toHaveBeenCalled();
    await toggle(0);
    expect(load.mock.calls).toEqual([['1']]);
    expect(container.textContent).toContain('child');
    await toggle(1);
    expect(load.mock.calls).toEqual([['1'], ['2']]);
    expect(container.textContent).toContain('no longer available');
    await toggle(2);
    expect(container.textContent).toContain('42');
    await toggle(1);
    await toggle(1);
    expect(load).toHaveBeenCalledTimes(3);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
