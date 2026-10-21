/** Runs inside the opaque-origin preview frame; captures bounded output and keeps DOM events alive. */
/**
 * Starts one document execution and sends plain-text output to its parent.
 * @param {{id: string, code: string}} request Compiled source and the host's run identifier.
 */
function startPreview(request) {
  const send = parent.postMessage.bind(parent);
  let count = 0;
  let size = 0;
  /** @param {unknown} value Console argument formatted without traversing circular references twice. */
  function format(value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    const seen = new WeakSet();
    try {
      return (
        JSON.stringify(value, (_key, item) => {
          if (typeof item === 'bigint') return `${item}n`;
          if (item && typeof item === 'object') {
            if (seen.has(item)) return '[Circular]';
            seen.add(item);
          }
          return item;
        }) ?? String(value)
      );
    } catch {
      return '[Unserializable value]';
    }
  }
  /** @param {...unknown} values Arguments captured from console calls and asynchronous errors. */
  function log(...values) {
    if (count >= 500) return;
    const limited = count === 499 || size >= 90_000;
    const line = limited
      ? '[Output limit reached. Further logs omitted.]'
      : values
          .map(format)
          .join(' ')
          .slice(0, Math.min(10_000, 90_000 - size));
    size += line.length;
    count = limited ? 500 : count + 1;
    send({ type: 'output', id: request.id, line }, '*');
  }
  for (const method of ['log', 'info', 'warn', 'error', 'debug', 'table']) console[method] = log;
  addEventListener('error', (event) => log(event.message));
  addEventListener('unhandledrejection', (event) => log(event.reason));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  Promise.resolve()
    .then(() =>
      new AsyncFunction('"use strict";\n' + request.code + '\n//# sourceURL=jsgoapp-preview.js')(),
    )
    .then(() => send({ type: 'complete', id: request.id }, '*'))
    .catch((error) => send({ type: 'complete', id: request.id, error: format(error) }, '*'));
}
