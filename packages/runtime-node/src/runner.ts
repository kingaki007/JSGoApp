/** Executes trusted local code inside a disposable Node/Electron utility process using one wire protocol. */
import ts from 'typescript';
import { inspect } from 'node:util';
import { isBuiltin, createRequire } from 'node:module';
import { createCapture, type RunRequest } from '@code-editor/core';
import { captureExpressions } from '@code-editor/core/expressions';
import { createInspector } from '@code-editor/core/inspect';
const require = createRequire(import.meta.url);
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
  /** @param error Optional top-level or asynchronous error; completion is emitted exactly once. */
  function finish(error?: unknown) {
    if (finished) return;
    finished = true;
    send({
      type: 'complete',
      id: request.id,
      ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
    });
  }
  const inspector = createInspector(request.inspect === true);
  /** @param values Console arguments formatted safely and bounded before sending to the host. */
  function log(...values: unknown[]) {
    if (finished || count >= 500) return;
    const limited = count === 499 || size >= 90_000;
    const line = limited
      ? '[Output limit reached. Further logs omitted.]'
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
    const inspected = limited ? null : inspector(values);
    count = limited ? 500 : count + 1;
    size += line.length;
    send({
      type: 'output',
      id: request.id,
      line,
      sourceLine: limited ? 0 : currentLine,
      ...(inspected ? { values: inspected } : {}),
    });
  }
  /** @param name Built-in Node module; third-party package and project resolution are deferred. */
  function requireBuiltin(name: string) {
    if (!isBuiltin(name))
      throw new Error('Only Node built-in modules are supported in this milestone.');
    return require(name);
  }
  const capturedConsole = { log, info: log, warn: log, error: log, debug: log, table: log };
  Object.assign(console, capturedConsole);
  process.once('uncaughtException', finish);
  process.once('unhandledRejection', finish);
  try {
    const transformed = captureExpressions(request.code);
    const { outputText, diagnostics } = ts.transpileModule(transformed.code, {
      reportDiagnostics: true,
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    });
    const syntax = diagnostics?.find(
      (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
    );
    if (syntax) throw new Error(ts.flattenDiagnosticMessageText(syntax.messageText, '\n'));
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const module = { exports: {} };
    await new AsyncFunction(
      'require',
      'exports',
      'module',
      'console',
      transformed.captureName,
      '"use strict";\n' + outputText + '\n//# sourceURL=jsgoapp-node.js',
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
    finish();
  } catch (error) {
    finish(error);
  }
}

if (port) port.once('message', (event) => void execute(event.data));
else process.once('message', (request: RunRequest) => void execute(request));
