/** Exercises theme changes in an isolated, hidden Electron renderer using the production app origin. */
import { BrowserWindow, type protocol } from 'electron';
import { checkIndependentScrolling } from './scrollSmoke';

// One dark and one light theme from packages/editor/src/themes.ts, used to exercise both
// app-chrome appearances without hardcoding the full 16-theme catalog in this test.
const darkTheme = 'Monokai';
const lightTheme = 'Visual Studio';

/**
 * Checks theme changes and persisted startup appearance without using the owner's saved drafts
 * or theme.
 * @param url Built playground URL served by the desktop protocol handler.
 * @param preload Absolute path to the built sandboxed desktop bridge.
 * @param handleAppRequest Desktop asset handler registered on the isolated test session.
 */
export async function checkRendererThemes(
  url: string,
  preload: string,
  handleAppRequest: Parameters<typeof protocol.handle>[1],
): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      offscreen: true,
      partition: 'theme-smoke',
    },
  });
  window.webContents.session.protocol.handle('jsgoapp', handleAppRequest);
  const errors: string[] = [];
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') errors.push(event.message);
  });

  /** @param label Theme gallery option to open the popover and select by its visible label. */
  async function selectTheme(label: string) {
    await window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const deadline = Date.now() + 12000;
        function openAndClick() {
          const trigger = document.querySelector('button[aria-label^="Theme:"]');
          if (!trigger) {
            if (Date.now() > deadline) return resolve(false);
            return setTimeout(openAndClick, 50);
          }
          trigger.click();
          setTimeout(() => {
            const option = [...document.querySelectorAll('[role="option"]')]
              .find((candidate) => candidate.textContent?.includes(${JSON.stringify(label)}));
            if (option) option.click();
            resolve(Boolean(option));
          }, 50);
        }
        openAndClick();
      })
    `);
  }

  /** @param appChrome Expected 'light' or 'dark' chrome after React and Monaco finish updating. */
  async function verify(appChrome: 'light' | 'dark') {
    const result = await window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const deadline = Date.now() + 12000;
        function check() {
          const editor = document.querySelector('.monaco-editor .view-lines');
          if (editor && document.documentElement.dataset.theme === '${appChrome}') {
            setTimeout(() => resolve(Boolean(document.querySelector('main') && document.querySelector('.monaco-editor'))), 300);
          } else if (Date.now() > deadline) resolve(false);
          else setTimeout(check, 50);
        }
        check();
      })
    `);
    if (!result)
      throw new Error(
        `Desktop theme ${appChrome} left the editor unavailable: ${errors.join('\n')}`,
      );
  }

  try {
    await window.loadURL(url);
    await window.webContents.executeJavaScript(`new Promise(resolve => {
      const timer = setInterval(() => {
        if (document.querySelector('.monaco-editor')) { clearInterval(timer); resolve(true); }
      }, 50);
      setTimeout(() => { clearInterval(timer); resolve(false); }, 12000);
    })`);
    await selectTheme(darkTheme);
    await verify('dark');
    for (const [label, appChrome] of [
      [lightTheme, 'light'],
      [darkTheme, 'dark'],
      [lightTheme, 'light'],
    ] as const) {
      await selectTheme(label);
      await verify(appChrome);
    }
    await window.loadURL(url);
    await verify('light');
    await selectTheme(darkTheme);
    await verify('dark');
    await checkIndependentScrolling(window, url);
  } finally {
    window.destroy();
  }
}
