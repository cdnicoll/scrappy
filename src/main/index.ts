import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'node:path'
import { Channels, type HotkeyStatus } from '../shared/ipc'

// Spike knobs. Override from the shell to test variants without editing code:
//   SCRAPPY_HOTKEY="Control+Alt+Space"
//   SCRAPPY_LEVEL="floating" | "screen-saver"
//   SCRAPPY_HIDE_ON_BLUR="0" to keep the panel open when it loses focus
const HOTKEY = process.env.SCRAPPY_HOTKEY ?? 'Control+Alt+Space'
const LEVEL: 'floating' | 'screen-saver' =
  process.env.SCRAPPY_LEVEL === 'screen-saver' ? 'screen-saver' : 'floating'
const HIDE_ON_BLUR = process.env.SCRAPPY_HIDE_ON_BLUR !== '0'

const PANEL_WIDTH = 520
const PANEL_HEIGHT = 220

let panel: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
let hotkeyRegistered = false
let quitting = false

const securePrefs = {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}

function loadPage(win: BrowserWindow, page: 'index' | 'capture'): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void win.loadURL(`${devUrl}/${page}.html`)
  } else {
    void win.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}

function createPanel(): BrowserWindow {
  const win = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    type: 'panel', // NSPanel: takes key focus without activating the app
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    skipTaskbar: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    hiddenInMissionControl: true,
    webPreferences: securePrefs,
  })

  win.setAlwaysOnTop(true, LEVEL)
  // skipTransformProcessType keeps the Dock icon: without it Electron flips the
  // app to a UI element app, which hides the Dock icon and the main window.
  win.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    skipTransformProcessType: true,
  })

  win.on('blur', () => {
    if (HIDE_ON_BLUR) hidePanel()
  })

  // Created once, shown and hidden. Never destroyed until the app quits.
  win.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      hidePanel()
    }
  })

  loadPage(win, 'capture')
  return win
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    title: 'Scrappy',
    webPreferences: securePrefs,
  })
  win.on('closed', () => {
    mainWindow = null
  })
  loadPage(win, 'index')
  return win
}

function showPanel(): void {
  if (!panel) return
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  panel.setBounds({
    x: Math.round(x + (width - PANEL_WIDTH) / 2),
    y: Math.round(y + (height - PANEL_HEIGHT) / 3),
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
  })
  panel.show()
  panel.focus()
  panel.webContents.focus()
  panel.webContents.send(Channels.captureShown)
}

function hidePanel(): void {
  if (panel?.isVisible()) panel.hide()
}

function togglePanel(): void {
  if (!panel) return
  if (panel.isVisible()) hidePanel()
  else showPanel()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) mainWindow = createMainWindow()
    mainWindow.show()
  })

  void app.whenReady().then(() => {
    ipcMain.handle(Channels.captureHide, () => hidePanel())
    ipcMain.handle(Channels.captureSubmit, (_event, text: unknown) => {
      // Step 1 has no vault. Log the length only so the spike proves the round trip.
      const length = typeof text === 'string' ? text.trim().length : 0
      console.log(`[scrappy] capture submitted, ${length} chars (not saved, vault is step 2)`)
      hidePanel()
    })
    ipcMain.handle(
      Channels.hotkeyStatus,
      (): HotkeyStatus => ({ accelerator: HOTKEY, registered: hotkeyRegistered }),
    )

    panel = createPanel()
    mainWindow = createMainWindow()

    hotkeyRegistered = globalShortcut.register(HOTKEY, togglePanel)
    console.log(
      `[scrappy] hotkey ${HOTKEY} ${hotkeyRegistered ? 'registered' : 'FAILED to register (taken by another app?)'}, level ${LEVEL}`,
    )

    app.on('activate', () => {
      if (!mainWindow) mainWindow = createMainWindow()
    })
  })

  app.on('before-quit', () => {
    quitting = true
  })

  // Keep running with no windows so the hotkey still works.
  app.on('window-all-closed', () => {})

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
}
