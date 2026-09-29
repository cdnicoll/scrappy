import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  Channels,
  type NotesChanged,
  type ScrappyApi,
  type VaultStatus,
} from '../shared/ipc'

const api: ScrappyApi = {
  hideCapture: () => ipcRenderer.invoke(Channels.captureHide),
  submitCapture: (text) => ipcRenderer.invoke(Channels.captureSubmit, text),
  onCaptureShown: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(Channels.captureShown, listener)
    return () => {
      ipcRenderer.removeListener(Channels.captureShown, listener)
    }
  },
  getDraft: () => ipcRenderer.invoke(Channels.draftGet),
  setDraft: (text) => ipcRenderer.invoke(Channels.draftSet, text),
  listNotes: () => ipcRenderer.invoke(Channels.notesList),
  readNote: (filename) => ipcRenderer.invoke(Channels.notesRead, filename),
  writeNote: (filename, text) => ipcRenderer.invoke(Channels.notesWrite, filename, text),
  createNote: () => ipcRenderer.invoke(Channels.notesCreate),
  onNotesChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, change: NotesChanged): void => callback(change)
    ipcRenderer.on(Channels.notesChanged, listener)
    return () => {
      ipcRenderer.removeListener(Channels.notesChanged, listener)
    }
  },
  getHotkeyStatus: () => ipcRenderer.invoke(Channels.hotkeyStatus),
  getVault: () => ipcRenderer.invoke(Channels.vaultGet),
  chooseVault: () => ipcRenderer.invoke(Channels.vaultChoose),
  onVaultChanged: (callback) => {
    const listener = (_event: IpcRendererEvent, status: VaultStatus): void => callback(status)
    ipcRenderer.on(Channels.vaultChanged, listener)
    return () => {
      ipcRenderer.removeListener(Channels.vaultChanged, listener)
    }
  },
}

contextBridge.exposeInMainWorld('scrappy', api)
