/** Shares process lifecycle, bounded output, validation, and cancellation across web and desktop hosts. */
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const runnerPath = fileURLToPath(new URL('./runner.cjs', import.meta.url));

/** Supplies OS paths needed by snippets without inheriting the host application's credentials or Node flags. */
export function runnerEnvironment() {
  const names = [
    'PATH',
    'Path',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'LANG',
  ];
  return Object.fromEntries(
    names
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  );
}

/** @param value Untrusted execution payload; source and identifier lengths are bounded before launch. */
export function validRequest(value) {
  return (
    !!value &&
    typeof value === 'object' &&
    value.environment === 'node' &&
    typeof value.id === 'string' &&
    /^[\w-]{1,100}$/.test(value.id) &&
    typeof value.code === 'string' &&
    value.code.length <= 100_000
  );
}

/** Starts the Node host's disposable process without shell interpolation or inherited Node CLI flags. */
function launchNode() {
  const child = fork(runnerPath, [], {
    execArgv: [],
    env: runnerEnvironment(),
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  return {
    /** @param request Compiled code and run identifier. */
    send: (request) => child.send(request),
    /** Forcefully terminates CPU-bound code in the directly owned process. */
    kill: () => child.kill('SIGKILL'),
    /** @param listener Structured child-message handler. */
    onMessage: (listener) => child.on('message', listener),
    /** @param listener Process-exit handler. */
    onExit: (listener) => child.on('exit', listener),
    /** @param listener Launch/error handler. */
    onError: (listener) => child.on('error', listener),
  };
}

/** Runs one trusted local snippet per process; this is lifecycle isolation, not a security sandbox. */
export class NodeRuntime {
  #cancel;
  #launch;
  #timeout;
  /** @param options Host process factory; defaults to Node child_process for the local web service. */
  constructor({ launch = launchNode, timeoutMs = 5000 } = {}) {
    this.#launch = launch;
    this.#timeout = timeoutMs;
  }
  /** @param request Validated Node source. @param onOutput Receives output while the process is running. */
  async run(request, onOutput) {
    this.stop();
    if (!validRequest(request))
      throw new Error('Invalid Node execution request (maximum source: 100,000 characters).');
    return new Promise((resolve) => {
      const lines = [];
      let size = 0;
      let done = false;
      let child;
      /** @param error Optional reason for stopping; every exit releases the child and deadline. */
      const finish = (error) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.#cancel = undefined;
        child?.kill();
        resolve({ id: request.id, lines, ...(error ? { error } : {}) });
      };
      const timer = setTimeout(() => finish('Execution exceeded 5 seconds.'), this.#timeout);
      this.#cancel = () => finish('Execution stopped.');
      try {
        child = this.#launch();
        child.onExit(() => finish('Node process exited before completion.'));
        child.onError((error) => finish(String(error?.message ?? error)));
        child.onMessage((message) => {
          if (done || !message || message.id !== request.id) return;
          if (
            message.type === 'output' &&
            typeof message.line === 'string' &&
            lines.length < 500 &&
            size < 100_000
          ) {
            const line = message.line.slice(0, Math.min(10_000, 100_000 - size));
            lines.push(line);
            size += line.length;
            onOutput?.(line);
          } else if (message.type === 'complete') {
            finish(typeof message.error === 'string' ? message.error.slice(0, 10_000) : undefined);
          }
        });
        child.send(request);
      } catch (error) {
        finish(String(error?.message ?? error));
      }
    });
  }
  /** Cancels the owned process and retains output already delivered to its caller. */
  stop() {
    this.#cancel?.();
  }
}
