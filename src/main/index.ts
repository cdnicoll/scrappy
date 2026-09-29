import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen } from 'electron'
import { mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Channels, type HotkeyStatus, type SubmitResult, type VaultStatus } from '../shared/ipc'
import { loadSettings, saveSettings, writeFileAtomic, type Settings } from './settings'
import { createNote, isDirectory } from './vault'

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
const MAX_NOTE_CHARS = 1_000_000
const DEFAULT_VAULT = join(homedir(), 'Scrappy')

// Settings and the capture draft live in the app data folder, never in the vault.
const settingsFile = (): string => join(app.getPath('userData'), 'settings.json')
const draftFile = (): string => join(app.getPath('userData'), 'capture-draft.md')

let settings: Settings = { vaultPath: null }

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

function vaultStatus(): VaultStatus {
  return { path: settings.vaultPath }
}

async function setVault(path: string): Promise<void> {
  settings = { ...settings, vaultPath: path }
  await saveSettings(settingsFile(), settings)
  mainWindow?.webContents.send(Channels.vaultChanged, vaultStatus())
}

/** Folder picker. Returns true when the user picked a folder. */
async function pickVaultFolder(): Promise<boolean> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choose the Scrappy vault folder',
    buttonLabel: 'Use this folder',
    defaultPath: settings.vaultPath ?? homedir(),
    properties: ['openDirectory', 'createDirectory'],
  }
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options)
  const picked = result.filePaths[0]
  if (result.canceled || !picked) return false
  await setVault(picked)
  return true
}

/** First launch, or the saved folder is gone: ask where notes should live. */
async function promptForVault(): Promise<void> {
  const missing = settings.vaultPath
  const options: Electron.MessageBoxOptions = {
    type: 'question',
    message: missing ? 'The vault folder was not found' : 'Where should Scrappy keep your notes?',
    detail: missing
      ? `${missing} is missing. Pick a folder to keep notes in.`
      : 'Notes are plain Markdown files in one folder.',
    buttons: [`Use ${DEFAULT_VAULT}`, 'Choose folder', 'Later'],
    defaultId: 0,
    cancelId: 2,
  }
  const { response } = mainWindow
    ? await dialog.showMessageBox(mainWindow, options)
    : await dialog.showMessageBox(options)
  if (response === 0) {
    await mkdir(DEFAULT_VAULT, { recursive: true })
    await setVault(DEFAULT_VAULT)
  } else if (response === 1) {
    await pickVaultFolder()
  }
}

async function submitCapture(text: unknown): Promise<SubmitResult> {
  if (typeof text !== 'string' || text.length > MAX_NOTE_CHARS) {
    return { ok: false, error: 'Note is not valid text or is too large.' }
  }
  if (text.trim() === '') {
    hidePanel()
    return { ok: true, filename: null }
  }
  if (!settings.vaultPath) {
    return { ok: false, error: 'No vault folder set. Open Scrappy to choose one.' }
  }
  try {
    const filename = await createNote(settings.vaultPath, text)
    await writeFileAtomic(draftFile(), '')
    hidePanel()
    return { ok: true, filename }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function readDraft(): Promise<string> {
  try {
    return await readFile(draftFile(), 'utf8')
  } catch {
    return ''
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) mainWindow = createMainWindow()
    mainWindow.show()
  })

  void app.whenReady().then(async () => {
    settings = await loadSettings(settingsFile())

    ipcMain.handle(Channels.captureHide, () => hidePanel())
    ipcMain.handle(Channels.captureSubmit, (_event, text: unknown) => submitCapture(text))
    ipcMain.handle(Channels.draftGet, () => readDraft())
    ipcMain.handle(Channels.draftSet, async (_event, text: unknown) => {
      if (typeof text === 'string' && text.length <= MAX_NOTE_CHARS) {
        await writeFileAtomic(draftFile(), text)
      }
    })
    ipcMain.handle(Channels.vaultGet, () => vaultStatus())
    ipcMain.handle(Channels.vaultChoose, async () => {
      await pickVaultFolder()
      return vaultStatus()
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

    if (!settings.vaultPath || !(await isDirectory(settings.vaultPath))) {
      await promptForVault()
    }
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
