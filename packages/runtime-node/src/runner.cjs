/** Executes trusted local code inside a disposable Node/Electron utility process using one wire protocol. */
const ts = require('typescript');
const { inspect } = require('node:util');
const { isBuiltin } = require('node:module');
const port = process.parentPort;
/** @param message Structured output sent through Electron message ports or Node IPC. */
function send(message) {
  if (port) port.postMessage(message);
  else if (process.connected) process.send(message);
}

/** @param request Compiled source and run identifier; the owning host validates size and environment. */
async function execute(request) {
  let count = 0;
  let size = 0;
  let finished = false;
  /** @param error Optional top-level or asynchronous error; completion is emitted exactly once. */
  function finish(error) {
    if (finished) return;
    finished = true;
    send({
      type: 'complete',
      id: request.id,
      ...(error ? { error: String(error.message ?? error) } : {}),
    });
  }
  /** @param values Console arguments formatted safely and bounded before sending to the host. */
  function log(...values) {
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
    count = limited ? 500 : count + 1;
    size += line.length;
    send({ type: 'output', id: request.id, line });
  }
  /** @param name Built-in Node module; third-party package and project resolution are deferred. */
  function requireBuiltin(name) {
    if (!isBuiltin(name))
      throw new Error('Only Node built-in modules are supported in this milestone.');
    return require(name);
  }
  const capturedConsole = { log, info: log, warn: log, error: log, debug: log, table: log };
  Object.assign(console, capturedConsole);
  process.once('uncaughtException', finish);
  process.once('unhandledRejection', finish);
  try {
    const { outputText, diagnostics } = ts.transpileModule(request.code, {
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
      '"use strict";\n' + outputText + '\n//# sourceURL=jsgoapp-node.js',
    )(requireBuiltin, module.exports, module, capturedConsole);
    finish();
  } catch (error) {
    finish(error);
  }
}

if (port) port.once('message', (event) => void execute(event.data));
else process.once('message', (request) => void execute(request));
