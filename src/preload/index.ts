import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { Channels, type ScrappyApi, type VaultStatus } from '../shared/ipc'

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
