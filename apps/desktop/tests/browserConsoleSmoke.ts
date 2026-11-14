/** Checks browser-value output in Chromium with the same opaque-origin sandbox as the app. */
import { BrowserWindow } from 'electron';
import path from 'node:path';
import type { RunResult } from '@code-editor/core';

/** Runs window and DOM logging against the real bundled frame runner. */
export async function checkBrowserConsole(): Promise<void> {
  // Build tooling is needed only by this source-checkout smoke test, never by packaged startup.
  const { build } = await import('esbuild');
  const bundle = await build({
    entryPoints: [path.resolve(__dirname, '../../web/src/frame.ts')],
    bundle: true,
    format: 'iife',
    write: false,
  });
  const runner = bundle.outputFiles[0].text.replace(/<\/(script)/gi, '<\\/$1');
  const html = `<!doctype html><html><body><script>${runner}</script></body></html>`;
  const host = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  try {
    await host.loadURL('data:text/html,<html><body></body></html>');
    const result: RunResult = await host.webContents.executeJavaScript(
      `(${runFrame.toString()})(${JSON.stringify(html)})`,
    );
    if (result.error) throw new Error(`Browser console failed: ${result.error}`);
    const values = result.details?.map((entry) => entry?.[0]);
    if (
      values?.[0]?.text !== 'Window' ||
      !values[0].entries?.length ||
      values[1]?.type !== 'dom' ||
      values[1].text !== '#document' ||
      !values[1].entries?.length ||
      values[2]?.text !== '<button id="demo">' ||
      values[2].entries?.[0]?.value.text !== '"Hello"' ||
      result.lines.at(-1) !== 'continued'
    ) {
      throw new Error(
        `Browser console did not preserve inspectable browser values: ${JSON.stringify(result)}`,
      );
    }
  } finally {
    host.destroy();
  }
}

/** @param html Runner page; this function is serialized into the isolated Chromium host. */
function runFrame(html: string): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.srcdoc = html;
    const timer = setTimeout(() => reject(new Error('Browser console smoke timed out')), 15000);
    window.addEventListener('message', (event) => {
      if (event.source !== frame.contentWindow) return;
      if (event.data.type === 'ready')
        frame.contentWindow?.postMessage(
          {
            id: 'browser-console',
            environment: 'browser',
            inspect: true,
            timeoutMs: 5000,
            code: `void (document.body.innerHTML = '<button id="demo">Hello</button>');
          console.log(window);
          console.log(document);
          console.log(document.getElementById('demo'));
          console.log(parent);
          console.log('continued');`,
          },
          '*',
        );
      if (event.data.type === 'complete') {
        clearTimeout(timer);
        frame.remove();
        const result = event.data.result as RunResult;
        resolve(result);
      }
    });
    document.body.append(frame);
  });
}
