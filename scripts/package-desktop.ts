/** Assembles a runnable desktop app folder for this machine from the Electron runtime and built outputs. */
import { cp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const productName = 'JSGoApp';
const electronPackage = join(root, 'apps/desktop/node_modules/electron');

/** Electron's executable name per platform; macOS uses an app bundle, which needs installer work. */
const executables: Partial<Record<NodeJS.Platform, { from: string; to: string }>> = {
  win32: { from: 'electron.exe', to: `${productName}.exe` },
  linux: { from: 'electron', to: productName.toLowerCase() },
};

/**
 * Fails early with the command that produces a missing build output.
 * @param path File or directory the package needs.
 * @param hint What to run when it is missing.
 */
async function requireBuilt(path: string, hint: string): Promise<void> {
  try {
    await stat(path);
  } catch {
    throw new Error(`Missing ${path}. ${hint}`);
  }
}

/**
 * Copies one path into the packaged app, creating parent folders.
 * @param from Source file or directory, relative to the repository root.
 * @param to Destination relative to the packaged app's `resources/app` folder.
 * @param app Absolute path of the packaged app's `resources/app` folder.
 */
async function copyInto(from: string, to: string, app: string): Promise<void> {
  const target = join(app, to);
  await mkdir(join(target, '..'), { recursive: true });
  await cp(join(root, from), target, { recursive: true });
}

/** Builds `release/JSGoApp-<platform>-<arch>` and returns the path of its executable. */
async function packageDesktop(): Promise<string> {
  const executable = executables[process.platform];
  if (!executable)
    throw new Error(
      `Packaging is not set up for ${process.platform}. Windows and Linux are supported; macOS needs an app bundle.`,
    );
  const version: string = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  await requireBuilt(join(electronPackage, 'dist', executable.from), 'Run pnpm install first.');
  await requireBuilt(join(root, 'apps/web/dist/index.html'), 'Run pnpm build first.');
  await requireBuilt(join(root, 'apps/desktop/dist/main.js'), 'Run pnpm build first.');
  await requireBuilt(join(root, 'packages/runtime-node/dist/runner.js'), 'Run pnpm build first.');

  const output = join(root, 'release', `${productName}-${process.platform}-${process.arch}`);
  try {
    // Replace the previous build completely so removed files do not linger.
    await rm(output, { recursive: true, force: true });
  } catch {
    throw new Error(`Could not replace ${output}. Close ${productName} and try again.`);
  }
  await cp(join(electronPackage, 'dist'), output, { recursive: true });
  await rename(join(output, executable.from), join(output, executable.to));
  // Electron runs `resources/app` when present; its demo app is not needed.
  await rm(join(output, 'resources/default_app.asar'), { force: true });

  const app = join(output, 'resources/app');
  // The layout mirrors the repository so the built main process finds the UI at ../../web/dist.
  await copyInto('apps/desktop/dist/main.js', 'apps/desktop/dist/main.js', app);
  await copyInto('apps/desktop/dist/preload.js', 'apps/desktop/dist/preload.js', app);
  await copyInto('apps/web/dist', 'apps/web/dist', app);
  const runtime = 'node_modules/@code-editor/runtime-node';
  await copyInto('packages/runtime-node/dist/index.js', `${runtime}/dist/index.js`, app);
  await copyInto('packages/runtime-node/dist/runner.js', `${runtime}/dist/runner.js`, app);
  await copyInto('packages/runtime-node/package.json', `${runtime}/package.json`, app);
  // The runner loads the TypeScript compiler at run time; only its entry file is required.
  const typescript = 'packages/runtime-node/node_modules/typescript';
  await copyInto(`${typescript}/package.json`, 'node_modules/typescript/package.json', app);
  await copyInto(
    `${typescript}/lib/typescript.js`,
    'node_modules/typescript/lib/typescript.js',
    app,
  );
  await copyInto(`${typescript}/LICENSE.txt`, 'node_modules/typescript/LICENSE.txt', app);
  await writeFile(
    join(app, 'package.json'),
    // productName names the user-data folder, which is kept when the app folder is replaced.
    `${JSON.stringify({ name: 'jsgoapp', productName, version, main: 'apps/desktop/dist/main.js' }, null, 2)}\n`,
  );
  return join(output, executable.to);
}

console.log(`Packaged ${productName}: ${await packageDesktop()}`);
