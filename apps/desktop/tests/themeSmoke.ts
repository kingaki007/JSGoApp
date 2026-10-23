/** Exercises theme changes in an isolated, hidden Electron renderer using the production app origin. */
import { BrowserWindow, type protocol } from 'electron';

/**
 * Checks theme changes and persisted Light startup without using the owner's saved drafts or theme.
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
      partition: 'theme-smoke',
    },
  });
  window.webContents.session.protocol.handle('jsgoapp', handleAppRequest);
  const errors: string[] = [];
  window.webContents.on('console-message', (event) => {
    if (event.level === 'error') errors.push(event.message);
  });

  /** @param theme Expected selected appearance after React and Monaco finish their updates. */
  async function verify(theme: string) {
    const result = await window.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const deadline = Date.now() + 12000;
        function check() {
          const input = document.querySelector('input[value="${theme}"]');
          const editor = document.querySelector('.monaco-editor .view-lines');
          if (input?.checked && editor && document.documentElement.dataset.theme === '${theme}') {
            setTimeout(() => resolve(Boolean(document.querySelector('main') && document.querySelector('.monaco-editor'))), 300);
          } else if (Date.now() > deadline) resolve(false);
          else setTimeout(check, 50);
        }
        check();
      })
    `);
    if (!result)
      throw new Error(`Desktop theme ${theme} left the editor unavailable: ${errors.join('\n')}`);
  }

  try {
    await window.loadURL(url);
    await window.webContents.executeJavaScript(`new Promise(resolve => {
      const timer = setInterval(() => {
        const input = document.querySelector('input[value="dark"]');
        if (input && document.querySelector('.monaco-editor')) { clearInterval(timer); input.click(); resolve(true); }
      }, 50);
      setTimeout(() => { clearInterval(timer); resolve(false); }, 12000);
    })`);
    await verify('dark');
    for (const theme of ['light', 'dark', 'light']) {
      await window.webContents.executeJavaScript(
        `document.querySelector('input[value="${theme}"]').click()`,
      );
      await verify(theme);
    }
    await window.loadURL(url);
    await verify('light');
    await window.webContents.executeJavaScript(
      `document.querySelector('input[value="dark"]').click()`,
    );
    await verify('dark');
  } finally {
    window.destroy();
  }
}
