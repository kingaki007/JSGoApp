/** Exposes only execution methods to the sandboxed UI; raw Electron IPC stays private. */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { RunRequest } from '@code-editor/core';

contextBridge.exposeInMainWorld('desktop', {
  /** @param request Compiled Node execution payload validated again by the main process. */
  run: (request: RunRequest) => ipcRenderer.invoke('jsgoapp:run', request),
  /** Terminates the current Node snippet. */
  stop: () => ipcRenderer.invoke('jsgoapp:stop'),
  /** @param listener Receives streamed output; returns a function removing this subscription. */
  onOutput(listener: (message: { id: string; line: string }) => void) {
    /** @param _event Private Electron event. @param message Structured run output. */
    const receive = (_event: IpcRendererEvent, message: { id: string; line: string }) =>
      listener(message);
    ipcRenderer.on('jsgoapp:output', receive);
    return () => ipcRenderer.removeListener('jsgoapp:output', receive);
  },
});
