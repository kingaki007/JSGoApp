/** Verifies independent editor/results scrolling in the rendered desktop workbench. */
import type { BrowserWindow } from 'electron';

/** @param host Isolated smoke window. @param url Playground URL to reload with test drafts. */
export async function checkIndependentScrolling(host: BrowserWindow, url: string): Promise<void> {
  host.setSize(1440, 900);
  await host.webContents.executeJavaScript(`localStorage.setItem('jsgoapp.drafts', JSON.stringify({
    version: 2, activeId: 'scroll-test', tabs: [{ id: 'scroll-test', name: 'scroll.js',
    language: 'javascript', code: Array.from({ length: 120 }, (_, i) => i < 2
      ? 'console.table([{ name: "first" }, { name: "second" }, { name: "third" }]);'
      : i === 2 ? 'console.log(Object.fromEntries(Array.from({ length: 238 }, (_, j) => ["field" + j, j])));'
      : i === 3 ? 'console.log((() => { let calls = 0; return { get answer() { return { count: ++calls }; }, get calls() { return calls; }, get broken() { throw new Error("getter failed"); }, set writeOnly(value) {} }; })());'
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
  const inlineExpansion = await host.webContents.executeJavaScript(`new Promise(resolve => {
    document.querySelector('[aria-label="Expand result of line 1"]').click();
    document.querySelector('[aria-label="Expand result of line 2"]').click();
    setTimeout(() => {
      const rows = [...document.querySelectorAll('.output-row-open')];
      const valid = rows.length === 2 && rows.every(row => {
        const style = getComputedStyle(row);
        return row.querySelector('table') && style.borderTopWidth === '0px' &&
          style.boxShadow === 'none' && style.maxHeight === 'none' && style.overflowY === 'visible';
      }) && rows[1].getBoundingClientRect().top >= rows[0].getBoundingClientRect().bottom;
      document.querySelector('[aria-label="Collapse result of line 1"]').click();
      setTimeout(() => resolve(valid && document.querySelectorAll('.output-row-open').length === 1 &&
        Boolean(document.querySelector('[aria-label="Collapse result of line 2"]'))), 100);
    }, 100);
  })`);
  if (!inlineExpansion) throw new Error('Result rows are not independently expanded inline');
  const lazyProperties = await host.webContents.executeJavaScript(`new Promise(resolve => {
    const output = document.querySelector('.output-aligned');
    if (Number.parseFloat(getComputedStyle(output).paddingBottom) < 8) return resolve(false);
    document.querySelector('[aria-label="Expand result of line 3"]').click();
    const deadline = Date.now() + 5000;
    function findRange() {
      const group = [...document.querySelectorAll('.value-toggle')].find(button => button.textContent.includes('Properties 200'));
      if (!group) {
        if (Date.now() > deadline) return resolve(false);
        return setTimeout(findRange, 50);
      }
      if (output.textContent.includes('field237')) return resolve(false);
      group.click();
      function findLastProperty() {
        if (output.textContent.includes('field237')) return resolve(!output.textContent.includes('more not shown'));
        if (Date.now() > deadline) return resolve(false);
        setTimeout(findLastProperty, 50);
      }
      findLastProperty();
    }
    findRange();
  })`);
  if (!lazyProperties) throw new Error('Browser property ranges were not requested on expansion');
  const getters = await host.webContents.executeJavaScript(`(async () => {
    // Expanding a row remounts its DOM node, so every check re-queries .output-row fresh
    // instead of reusing a reference captured before the click.
    const row = () => document.querySelectorAll('.output-row')[3];
    document.querySelector('[aria-label="Expand result of line 4"]').click();
    async function waitFor(read) {
      const deadline = Date.now() + 4000;
      while (Date.now() < deadline) { const value = read(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 30)); }
      throw new Error('Getter smoke timed out');
    }
    const calls = await waitFor(() => document.querySelector('[aria-label="Evaluate getter calls"]'));
    if (row().querySelector('[aria-label="Evaluate getter writeOnly"]')) return false;
    calls.click();
    await waitFor(() => row().textContent.includes('calls: 0'));
    document.querySelector('[aria-label="Evaluate getter answer"]').click();
    const object = await waitFor(() => [...row().querySelectorAll('.value-toggle')].find(button => button.textContent.includes('answer:')));
    object.click();
    await waitFor(() => row().textContent.includes('count: 1'));
    document.querySelector('[aria-label="Evaluate getter broken"]').click();
    await waitFor(() => row().textContent.includes('Getter threw: Error: getter failed'));
    return row().textContent.includes('[Setter]') && row().textContent.includes('count: 1');
  })()`);
  if (!getters) throw new Error('Browser getters did not evaluate only on explicit clicks');
}
