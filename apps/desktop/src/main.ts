/** Boots the shared UI in Electron and owns disposable Node utility processes behind validated IPC. */
import {
  app,
  BrowserWindow,
  ipcMain,
  utilityProcess,
  protocol,
  net,
  type IpcMainInvokeEvent,
} from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { NodeRuntime, RunnerProcess } from '@code-editor/runtime-node';

// A standard app origin lets bundled Monaco workers and local storage work without file-origin exceptions.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'jsgoapp',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

let mainWindow: BrowserWindow | undefined;
let activeRuntime: NodeRuntime | undefined;

/** Starts the desktop host after Electron is ready and loads the same UI used by the browser app. */
async function start() {
  const pageDirectory = path.resolve(__dirname, '../../web/dist');
  /** @param request Local app asset request; paths must remain inside the built UI directory. */
  protocol.handle('jsgoapp', (request) => {
    try {
      const url = new URL(request.url);
      if (url.host !== 'app') return new Response('Unknown app host.', { status: 403 });
      const route = url.pathname.replace(/\/+$/, '') || '/';
      const assetPath = route === '/' || route === '/playground' ? '/index.html' : url.pathname;
      const file = path.resolve(pageDirectory, '.' + decodeURIComponent(assetPath));
      const relative = path.relative(pageDirectory, file);
      if (relative.startsWith('..') || path.isAbsolute(relative))
        return new Response('Invalid asset path.', { status: 403 });
      return net.fetch(pathToFileURL(file).href);
    } catch {
      return new Response('Invalid asset request.', { status: 400 });
    }
  });
  const { NodeRuntime, runnerPath, validRequest, runnerEnvironment } =
    await import('@code-editor/runtime-node');
  /** Creates a Node utility process and adapts Electron message ports to the shared runner protocol. */
  function launch(): RunnerProcess {
    const child = utilityProcess.fork(runnerPath, [], {
      stdio: 'ignore',
      env: runnerEnvironment(),
      serviceName: 'JSGoApp Node runner',
    });
    return {
      /** @param request Validated source sent once the process spawns. */
      send: (request) => child.once('spawn', () => child.postMessage(request)),
      /** Terminates the snippet's utility process. */
      kill: () => {
        if (!child.pid) {
          child.kill();
          return;
        }
        try {
          process.kill(child.pid, 'SIGKILL');
        } catch {
          child.kill();
        }
      },
      /** @param listener Structured child output callback. */
      onMessage: (listener) => child.on('message', listener),
      /** @param listener Child exit callback. */
      onExit: (listener) => child.on('exit', listener),
      /** @param listener Child launch/error callback. */
      onError: (listener) => child.on('error', (type) => listener(new Error(String(type)))),
    };
  }
  const runtime = new NodeRuntime({ launch });
  activeRuntime = runtime;
  if (process.argv.includes('--smoke-test')) {
    const result = await runtime.run({
      id: 'smoke',
      code: 'console.log(process.versions.node, typeof window, require("node:path").basename("/hello/test.js"));',
      environment: 'node',
    });
    const timeout = await new NodeRuntime({ launch, timeoutMs: 1500 }).run({
      id: 'timeout',
      environment: 'node',
      code: 'while (true) {}',
    });
    const asset = await net.fetch('jsgoapp://app/playground');
    const validAsset = asset.ok && (await asset.text()).includes('id="root"');
    console.log(JSON.stringify({ execution: result, timeout: timeout.error, assets: validAsset }));
    app.exit(result.error || !timeout.error?.includes('exceeded') || !validAsset ? 1 : 0);
    return;
  }
  const development = process.argv.includes('--dev');
  /** @param target Navigation destination; only the app's two routes may load in this window. */
  function isAppPage(target: string) {
    try {
      const url = new URL(target);
      const correctHost = development
        ? url.protocol === 'http:' && url.host === '127.0.0.1:5173'
        : url.protocol === 'jsgoapp:' && url.host === 'app';
      return (
        correctHost && ['/', '/index.html', '/playground', '/playground/'].includes(url.pathname)
      );
    } catch {
      return false;
    }
  }
  /** @param event IPC sender; only our top-level application frame may invoke Node execution. */
  function trusted(event: IpcMainInvokeEvent) {
    return (
      mainWindow &&
      event.sender === mainWindow.webContents &&
      event.senderFrame === mainWindow.webContents.mainFrame &&
      event.senderFrame.url.startsWith(development ? 'http://127.0.0.1:5173/' : 'jsgoapp://app/')
    );
  }
  ipcMain.handle('jsgoapp:run', (event, request) => {
    if (!trusted(event) || !validRequest(request)) throw new Error('Invalid execution request.');
    return runtime.run(request, (line) => {
      if (!event.sender.isDestroyed())
        event.sender.send('jsgoapp:output', { id: request.id, line });
    });
  });
  ipcMain.handle('jsgoapp:stop', (event) => {
    if (!trusted(event)) throw new Error('Invalid execution sender.');
    runtime.stop();
  });
  /** Opens the workbench and stops execution when its window closes or reloads. */
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 720,
      minHeight: 540,
      title: 'JSGoApp',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    mainWindow.webContents.on('will-navigate', (event, target) => {
      if (!isAppPage(target)) event.preventDefault();
    });
    mainWindow.webContents.on('will-redirect', (event) => event.preventDefault());
    mainWindow.webContents.on('did-start-navigation', () => runtime.stop());
    mainWindow.webContents.on('render-process-gone', () => runtime.stop());
    mainWindow.on('closed', () => {
      runtime.stop();
      mainWindow = undefined;
    });
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    if (development) void mainWindow.loadURL('http://127.0.0.1:5173/playground');
    else void mainWindow.loadURL('jsgoapp://app/playground');
  }
  createWindow();
  app.on('activate', () => {
    if (!mainWindow) createWindow();
  });
}

app
  .whenReady()
  .then(start)
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
app.on('before-quit', () => activeRuntime?.stop());
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
