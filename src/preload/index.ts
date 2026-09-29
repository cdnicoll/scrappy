import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { Channels, type ScrappyApi } from '../shared/ipc'

/** Subscribe to a main to renderer event. Returns the unsubscribe function. */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: ScrappyApi = {
  hideCapture: () => ipcRenderer.invoke(Channels.captureHide),
  submitCapture: (text) => ipcRenderer.invoke(Channels.captureSubmit, text),
  onCaptureShown: (callback) => subscribe<void>(Channels.captureShown, () => callback()),
  getDraft: () => ipcRenderer.invoke(Channels.draftGet),
  setDraft: (text) => ipcRenderer.invoke(Channels.draftSet, text),

  listNotes: () => ipcRenderer.invoke(Channels.notesList),
  readNote: (filename) => ipcRenderer.invoke(Channels.notesRead, filename),
  writeNote: (filename, text) => ipcRenderer.invoke(Channels.notesWrite, filename, text),
  createNote: () => ipcRenderer.invoke(Channels.notesCreate),
  searchNotes: (query) => ipcRenderer.invoke(Channels.notesSearch, query),
  trashNote: (filename) => ipcRenderer.invoke(Channels.notesTrash, filename),
  onNotesChanged: (callback) => subscribe(Channels.notesChanged, callback),

  getPreferences: () => ipcRenderer.invoke(Channels.prefsGet),
  chooseVault: () => ipcRenderer.invoke(Channels.vaultChoose),
  setHotkey: (accelerator) => ipcRenderer.invoke(Channels.prefsSetHotkey, accelerator),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke(Channels.prefsSetLaunchAtLogin, enabled),
  onPreferencesChanged: (callback) => subscribe(Channels.prefsChanged, callback),

  takePendingCommand: () => ipcRenderer.invoke(Channels.commandTake),
  onCommand: (callback) => subscribe(Channels.command, callback),
}

contextBridge.exposeInMainWorld('scrappy', api)
