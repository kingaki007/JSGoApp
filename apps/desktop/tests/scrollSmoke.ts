/** Verifies independent editor/results scrolling in the rendered desktop workbench. */
import type { BrowserWindow } from 'electron';

/** @param host Isolated smoke window. @param url Playground URL to reload with test drafts. */
export async function checkIndependentScrolling(host: BrowserWindow, url: string): Promise<void> {
  host.setSize(1440, 900);
  await host.webContents.executeJavaScript(`localStorage.setItem('jsgoapp.drafts', JSON.stringify({
    version: 2, activeId: 'scroll-test', tabs: [{ id: 'scroll-test', name: 'scroll.js',
    language: 'javascript', code: Array.from({ length: 120 }, (_, i) => i < 2
      ? 'console.table([{ name: "first" }, { name: "second" }, { name: "third" }]);'
      : 'console.log(' + i + ');').join('\\n') }]
  }));`);
  await host.loadURL(url);
  const ready = await host.webContents.executeJavaScript(`new Promise(resolve => {
    const deadline = Date.now() + 15000;
    function check() {
      if (document.querySelectorAll('.output-row').length === 120) return resolve(true);
      if (Date.now() > deadline) return resolve(false);
      setTimeout(check, 50);
    }
    check();
  })`);
  if (!ready) throw new Error('Scroll smoke did not receive aligned output');

  /** Captures geometry from both panes after Chromium has applied scroll events. */
  async function snapshot() {
    return host.webContents.executeJavaScript(`new Promise(resolve => setTimeout(() => {
      const output = document.querySelector('.output-aligned');
      const editor = document.querySelector('.monaco-editor');
      const rect = editor.getBoundingClientRect();
      const outputRect = output.getBoundingClientRect();
      resolve({ outputScroll: output.scrollTop, outputHeight: output.scrollHeight,
        outputClient: output.clientHeight, rowTop: document.querySelector('.output-row').getBoundingClientRect().top,
        editorLines: document.querySelector('.view-lines').textContent,
        editorX: Math.round(rect.x + rect.width / 2), editorY: Math.round(rect.y + rect.height / 2),
        outputX: Math.round(outputRect.x + outputRect.width / 2), outputY: Math.round(outputRect.y + outputRect.height / 2)
      });
    }, 200))`);
  }
  const initial = await snapshot();
  if (initial.outputHeight <= initial.outputClient)
    throw new Error('Results have no scrollable extent');
  await host.webContents.executeJavaScript(`(() => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 600 });
    Object.defineProperty(event, 'wheelDeltaY', { value: -600 });
    document.querySelector('.monaco-editor .view-lines').dispatchEvent(event);
  })()`);
  const editorScrolled = await snapshot();
  if (
    editorScrolled.editorLines === initial.editorLines ||
    editorScrolled.outputScroll !== initial.outputScroll ||
    editorScrolled.rowTop !== initial.rowTop
  )
    throw new Error(
      `Editor scroll moved results or did not scroll: ${JSON.stringify({ initial, editorScrolled })}`,
    );
  await host.webContents.executeJavaScript(
    `document.querySelector('.output-aligned').scrollTop = 600`,
  );
  const outputScrolled = await snapshot();
  if (
    outputScrolled.outputScroll <= editorScrolled.outputScroll ||
    outputScrolled.editorLines !== editorScrolled.editorLines
  )
    throw new Error('Results scroll moved editor or did not scroll');
  const tablesDoNotOverlap = await host.webContents.executeJavaScript(`new Promise(resolve => {
    const output = document.querySelector('.output-aligned');
    output.scrollTop = 0;
    const before = document.querySelectorAll('.output-row')[1].getBoundingClientRect().top;
    document.querySelector('.output-row .value-toggle').click();
    setTimeout(() => {
      const rows = document.querySelectorAll('.output-row');
      const first = rows[0].getBoundingClientRect();
      const second = rows[1].getBoundingClientRect();
      const valid = Boolean(rows[0].querySelector('table')) && second.top >= first.bottom && second.top > before;
      rows[0].querySelector('.value-toggle').click();
      setTimeout(() => resolve(valid && document.querySelectorAll('.output-row')[1].getBoundingClientRect().top === before), 100);
    }, 100);
  })`);
  if (!tablesDoNotOverlap)
    throw new Error('Expanded table covers later results or fails to collapse');
}
