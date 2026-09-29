import { contextBridge, ipcRenderer } from 'electron'
import { Channels, type HotkeyStatus, type ScrappyApi } from '../shared/ipc'

const api: ScrappyApi = {
  hideCapture: () => ipcRenderer.invoke(Channels.captureHide),
  submitCapture: (text: string) => ipcRenderer.invoke(Channels.captureSubmit, text),
  onCaptureShown: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(Channels.captureShown, listener)
    return () => {
      ipcRenderer.removeListener(Channels.captureShown, listener)
    }
  },
  getHotkeyStatus: (): Promise<HotkeyStatus> => ipcRenderer.invoke(Channels.hotkeyStatus),
}

contextBridge.exposeInMainWorld('scrappy', api)
