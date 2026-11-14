/** Executes trusted local code inside a disposable Node/Electron utility process using one wire protocol. */
import ts from 'typescript';
import { inspect } from 'node:util';
import { isBuiltin, createRequire } from 'node:module';
import { createCapture, type RunRequest } from '@code-editor/core';
import { createConsole, type ConsoleLevel } from '@code-editor/core/console';
import { readEnv } from '@code-editor/core/env';
import { traceError } from '@code-editor/core/errors';
import { captureExpressions } from '@code-editor/core/expressions';
import { decodeLineMap } from '@code-editor/core/sourceMap';
import { createInspector } from '@code-editor/core/inspect';
import { createTableBuilder } from '@code-editor/core/table';
const require = createRequire(import.meta.url);
// Names the snippet in engine stacks, so its frames can be told apart from the runner's own.
const scriptName = 'jsgoapp-node.js';
const port = (
  process as NodeJS.Process & {
    parentPort?: {
      postMessage(message: unknown): void;
      once(event: 'message', listener: (event: { data: RunRequest }) => void): void;
    };
  }
).parentPort;
/** @param message Structured output sent through Electron message ports or Node IPC. */
function send(message: unknown) {
  if (port) port.postMessage(message);
  else if (process.connected) process.send?.(message);
}

/** @param request Compiled source and run identifier; the owning host validates size and environment. */
async function execute(request: RunRequest) {
  // The host ends this process after it receives completion. Without a pending timer the process
  // could exit as soon as the snippet finished, before queued output and completion were delivered.
  setInterval(() => {}, 2 ** 30);
  process.once('disconnect', () => process.exit());
  let count = 0;
  let size = 0;
  let currentLine = 0;
  let finished = false;
  // Module syntax is compiled to CommonJS before running, which moves lines; this maps them back.
  let compiledLines: number[] | undefined;
  /** @param error Optional top-level or asynchronous error; completion is emitted exactly once. */
  function finish(error?: unknown) {
    if (finished) return;
    finished = true;
    const trace = error
      ? traceError(error, scriptName, 1, (line) =>
          compiledLines ? (compiledLines[line - 1] ?? 0) : line,
        )
      : undefined;
    send({
      type: 'complete',
      id: request.id,
      ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
      ...(trace?.line ? { errorLine: trace.line, errorFrames: trace.frames } : {}),
    });
  }
  const inspector = createInspector(request.inspect === true);
  const buildTable = createTableBuilder();
  /**
   * Formats one entry safely and sends it to the host within the output limits.
   * @param level Console level of the entry. @param values Console arguments or one result.
   * @param kind Marks a `console.table` call, whose first argument may be shown as a table.
   */
  function emit(level: ConsoleLevel, values: unknown[], kind?: 'table') {
    if (finished || count >= 500) return;
    const limited = count === 499 || size >= 90_000;
    const table = !limited && kind === 'table' ? buildTable(values[0], values[1]) : null;
    const line = limited
      ? '[Output limit reached. Further logs omitted.]'
      : table
        ? table.text.slice(0, Math.min(10_000, 90_000 - size))
        : values
            .map((value) =>
              typeof value === 'string'
                ? value
                : inspect(value, {
                    depth: 4,
                    maxArrayLength: 50,
                    maxStringLength: 10_000,
                    getters: false,
                  }),
            )
            .join(' ')
            .slice(0, Math.min(10_000, 90_000 - size));
    const inspected = limited ? null : table ? [table.value] : inspector(values);
    count = limited ? 500 : count + 1;
    size += line.length;
    send({
      type: 'output',
      id: request.id,
      line,
      sourceLine: limited ? 0 : currentLine,
      ...(inspected ? { values: inspected } : {}),
      ...(level !== 'log' && !limited ? { level } : {}),
    });
  }
  /** @param value One automatic expression result, reported as a plain log. */
  const log = (value: unknown) => emit('log', [value]);
  /** @param name Built-in Node module; third-party package and project resolution are deferred. */
  function requireBuiltin(name: string) {
    if (!isBuiltin(name))
      throw new Error('Only Node built-in modules are supported in this milestone.');
    return require(name);
  }
  const capturedConsole = createConsole(emit);
  Object.assign(console, capturedConsole);
  process.once('uncaughtException', finish);
  process.once('unhandledRejection', finish);
  // This process is disposable and exits after one run, so there is nothing to leak into.
  const env = readEnv(request.env);
  if (env) Object.assign(process.env, env);
  try {
    const transformed = captureExpressions(request.code);
    const { outputText, diagnostics, sourceMapText } = ts.transpileModule(transformed.code, {
      reportDiagnostics: true,
      compilerOptions: {
        sourceMap: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    });
    const syntax = diagnostics?.find(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (syntax) throw new Error(ts.flattenDiagnosticMessageText(syntax.messageText, '\n'));
    try {
      const mappings: unknown = JSON.parse(sourceMapText ?? '{}').mappings;
      if (typeof mappings === 'string') compiledLines = decodeLineMap(mappings);
    } catch {
      // Without a usable map, error lines are reported as unknown rather than guessed.
      compiledLines = [];
    }
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const module = { exports: {} };
    await new AsyncFunction(
      'require',
      'exports',
      'module',
      'console',
      transformed.captureName,
      '"use strict";\n' + outputText + '\n//# sourceURL=' + scriptName,
    )(
      requireBuiltin,
      module.exports,
      module,
      capturedConsole,
      createCapture(
        capturedConsole,
        (line) => {
          currentLine = line;
        },
        log,
        request.showUndefined === true,
      ),
    );
    // A rejection caused by the last statements is only reported after the code returns, so wait
    // one turn of the event loop before reporting success.
    await new Promise((resolve) => setTimeout(resolve, 0));
    finish();
  } catch (error) {
    finish(error);
  }
}

if (port) port.once('message', (event) => void execute(event.data));
else process.once('message', (request: RunRequest) => void execute(request));
