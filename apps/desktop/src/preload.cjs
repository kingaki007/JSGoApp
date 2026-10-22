/** Exposes only execution methods to the sandboxed UI; raw Electron IPC stays private. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  /** @param request Compiled Node execution payload validated again by the main process. */
  run: (request) => ipcRenderer.invoke('jsgoapp:run', request),
  /** Terminates the current Node snippet. */
  stop: () => ipcRenderer.invoke('jsgoapp:stop'),
  /** @param listener Receives streamed output; returns a function removing this subscription. */
  onOutput(listener) {
    /** @param _event Private Electron event. @param message Structured run output. */
    const receive = (_event, message) => listener(message);
    ipcRenderer.on('jsgoapp:output', receive);
    return () => ipcRenderer.removeListener('jsgoapp:output', receive);
  },
});
