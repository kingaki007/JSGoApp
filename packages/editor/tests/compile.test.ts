/** Verifies compiler pass-through, TypeScript emission, syntax errors, and temporary-model cleanup. */
import { describe, expect, it, vi } from 'vitest';
import type { Monaco } from '@monaco-editor/react';
import { compileSource } from '../src/compile';

/** Creates a controlled Monaco service; each test selects its emission or failure behavior. */
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
    expect(await compileSource(fixture.monaco, 'console.log(42);', 'javascript')).toEqual({
      code: 'console.log(42);',
    });
    expect(fixture.createModel).not.toHaveBeenCalled();
  });

  it('compiles a source snapshot and disposes it after emission', async () => {
    const fixture = compilerFixture();
    const source = 'const value: number = 42;';
    expect(await compileSource(fixture.monaco, source, 'typescript')).toEqual({
      code: 'const value = 42;',
    });
    expect(fixture.createModel.mock.calls[0].slice(0, 2)).toEqual([
      `${source}\nexport {};\n`,
      'typescript',
    ]);
    expect(fixture.model.dispose).toHaveBeenCalledOnce();
  });

  it('removes the synthetic module marker without stripping user imports', async () => {
    const fixture = compilerFixture();
    fixture.worker.getEmitOutput.mockResolvedValue({
      outputFiles: [
        {
          name: 'snapshot.js',
          text: 'import path from "node:path";\nconsole.log(path);\nexport {};\n',
        },
      ],
      emitSkipped: false,
    });
    expect(
      await compileSource(
        fixture.monaco,
        'import path from "node:path"; console.log(path);',
        'typescript',
      ),
    ).toEqual({ code: 'import path from "node:path";\nconsole.log(path);' });
  });

  it('strips the map reference and returns draft line origins from the emitted source map', async () => {
    const fixture = compilerFixture();
    fixture.worker.getEmitOutput.mockResolvedValue({
      outputFiles: [
        { name: 'snapshot.js.map', text: JSON.stringify({ version: 3, mappings: 'AAEA;AACA' }) },
        {
          name: 'snapshot.js',
          text: 'const value = 1;\nvalue;\nexport {};\n//# sourceMappingURL=snapshot.js.map',
        },
      ],
      emitSkipped: false,
    });
    expect(
      await compileSource(
        fixture.monaco,
        'type T = 1;\n\nconst value: T = 1;\nvalue;',
        'typescript',
      ),
    ).toEqual({ code: 'const value = 1;\nvalue;', lineMap: [3, 4] });
  });

  it('falls back to unchanged lines when the source map is malformed', async () => {
    const fixture = compilerFixture();
    fixture.worker.getEmitOutput.mockResolvedValue({
      outputFiles: [
        { name: 'snapshot.js.map', text: '{broken' },
        { name: 'snapshot.js', text: 'value;' },
      ],
      emitSkipped: false,
    });
    expect(await compileSource(fixture.monaco, 'value;', 'typescript')).toEqual({ code: 'value;' });
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
