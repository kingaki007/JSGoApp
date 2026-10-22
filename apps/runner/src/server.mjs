/** Serves the local-only web execution transport; the future accounts API remains a separate NestJS app. */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { NodeRuntime, validRequest } from '@code-editor/runtime-node';

/** Creates a loopback runner service with bounded requests and cancellation when the browser disconnects. */
export function createRunnerServer() {
  let active = 0;
  return createServer(async (request, response) => {
    // A custom header prevents cross-site simple-form requests. No CORS permission is granted.
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (
      !host?.startsWith('127.0.0.1:') ||
      request.headers['x-jsgoapp-runner'] !== '1' ||
      (origin && origin !== 'http://127.0.0.1:5173')
    ) {
      response.writeHead(403).end('Local JSGoApp requests only.');
      return;
    }
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ available: true, nodeVersion: process.versions.node }));
      return;
    }
    if (request.method !== 'POST' || request.url !== '/runs') {
      response.writeHead(404).end();
      return;
    }
    if (active >= 4) {
      response.writeHead(429).end('Runner busy.');
      return;
    }
    if (request.headers['content-type'] !== 'application/json') {
      response.writeHead(415).end();
      return;
    }
    active++;
    const runtime = new NodeRuntime();
    response.on('close', () => runtime.stop());
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 500_000) {
          response.writeHead(413).end('Source too large.');
          return;
        }
        chunks.push(chunk);
      }
      const run = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!validRequest(run)) {
        response.writeHead(400).end('Invalid execution request.');
        return;
      }
      if (response.destroyed) return;
      response.writeHead(200, {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-store',
      });
      const result = await runtime.run(run, (line) => {
        response.write(JSON.stringify({ type: 'output', id: run.id, line }) + '\n');
      });
      if (!response.destroyed)
        response.end(
          JSON.stringify({
            type: 'complete',
            result: { id: result.id, ...(result.error ? { error: result.error } : {}) },
          }) + '\n',
        );
    } catch {
      if (!response.headersSent) response.writeHead(400);
      response.end();
    } finally {
      runtime.stop();
      active--;
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createRunnerServer();
  server.listen(5180, '127.0.0.1', () =>
    console.log('JSGoApp local Node runner: http://127.0.0.1:5180'),
  );
}
