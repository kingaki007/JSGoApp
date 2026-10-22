/** Verifies HTTP execution and the local service's cross-origin request boundary. */
import { afterEach, expect, it } from 'vitest';
// The HTTP service is executable JavaScript; its behavior is checked through the real socket interface.
// @ts-expect-error This host intentionally exports plain JavaScript without a separate declaration package.
import { createRunnerServer } from '../src/server.mjs';
import type { Server } from 'node:http';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
  servers.length = 0;
});

/** Starts a local execution service on an OS-assigned port and returns its address. */
async function startServer() {
  const server = createRunnerServer() as Server;
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address.');
  return `http://127.0.0.1:${address.port}`;
}

it('streams output and completion from the shared Node runner', async () => {
  const url = await startServer();
  const response = await fetch(`${url}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-JSGoApp-Runner': '1',
      Origin: 'http://127.0.0.1:5173',
    },
    body: JSON.stringify({
      id: 'web-run',
      environment: 'node',
      code: 'console.log(typeof process, typeof document);',
    }),
  });
  expect(response.status).toBe(200);
  const messages = (await response.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(messages[0]).toEqual({ type: 'output', id: 'web-run', line: 'object undefined' });
  expect(messages[1].result.error).toBeUndefined();
});

it('rejects other origins and requests without the explicit runner header', async () => {
  const url = await startServer();
  expect((await fetch(`${url}/health`)).status).toBe(403);
  expect(
    (
      await fetch(`${url}/health`, {
        headers: { 'X-JSGoApp-Runner': '1', Origin: 'https://example.com' },
      })
    ).status,
  ).toBe(403);
  expect((await fetch(`${url}/health`, { headers: { 'X-JSGoApp-Runner': '1' } })).status).toBe(200);
});
