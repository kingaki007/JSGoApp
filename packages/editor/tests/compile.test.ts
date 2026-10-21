import { describe, expect, it, vi } from 'vitest';
import type { Monaco } from '@monaco-editor/react';
import { compileSource } from '../src/compile';

function compilerFixture() {
  const model = { dispose: vi.fn(), getPositionAt: () => ({ lineNumber: 2, column: 4 }) };
  const worker = {
    getSyntacticDiagnostics: vi.fn().mockResolvedValue([]),
    getEmitOutput: vi.fn().mockResolvedValue({
      outputFiles: [{ name: 'snapshot.js', text: 'const value = 42;' }],
      emitSkipped: false,
    }),
  };
  const createModel = vi.fn().mockReturnValue(model);
  const getWorker = vi.fn().mockResolvedValue(worker);
  const monaco = {
    Uri: { parse: (value: string) => ({ toString: () => value }) },
    editor: { createModel },
    typescript: { getTypeScriptWorker: vi.fn().mockResolvedValue(getWorker) },
  } as unknown as Monaco;
  return { monaco, model, worker, createModel };
}

describe('editor compilation boundary', () => {
  it('passes JavaScript through without creating compiler resources', async () => {
    const fixture = compilerFixture();
    expect(await compileSource(fixture.monaco, 'console.log(42);', 'javascript')).toBe(
      'console.log(42);',
    );
    expect(fixture.createModel).not.toHaveBeenCalled();
  });

  it('compiles a source snapshot and disposes it after emission', async () => {
    const fixture = compilerFixture();
    const source = 'const value: number = 42;';
    expect(await compileSource(fixture.monaco, source, 'typescript')).toBe('const value = 42;');
    expect(fixture.createModel.mock.calls[0].slice(0, 2)).toEqual([source, 'typescript']);
    expect(fixture.model.dispose).toHaveBeenCalledOnce();
  });

  it('reports syntax locations without emitting and releases the snapshot', async () => {
    const fixture = compilerFixture();
    fixture.worker.getSyntacticDiagnostics.mockResolvedValue([
      { start: 10, messageText: 'Type expected.' },
    ]);
    await expect(compileSource(fixture.monaco, 'const value: = 42;', 'typescript')).rejects.toThrow(
      'TypeScript 2:4: Type expected.',
    );
    expect(fixture.worker.getEmitOutput).not.toHaveBeenCalled();
    expect(fixture.model.dispose).toHaveBeenCalledOnce();
  });

  it('releases the snapshot when the language service fails', async () => {
    const fixture = compilerFixture();
    fixture.worker.getEmitOutput.mockRejectedValue(new Error('Worker unavailable'));
    await expect(compileSource(fixture.monaco, 'const value = 42;', 'typescript')).rejects.toThrow(
      'Worker unavailable',
    );
    expect(fixture.model.dispose).toHaveBeenCalledOnce();
  });
});
