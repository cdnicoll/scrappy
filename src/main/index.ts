import { app, BrowserWindow, dialog, globalShortcut, ipcMain, screen } from 'electron'
import { mkdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  Channels,
  type HotkeyStatus,
  type NotesChanged,
  type SubmitResult,
  type VaultStatus,
} from '../shared/ipc'
import { loadSettings, saveSettings, writeFileAtomic, type Settings } from './settings'
import { createNote, isDirectory, isNoteFilename, listNotes, readNote, writeNote } from './vault'
import { watchVault, type VaultWatcher } from './watcher'

// Spike knobs. Override from the shell to test variants without editing code:
//   SCRAPPY_HOTKEY="Control+Alt+Space"
//   SCRAPPY_LEVEL="floating" | "screen-saver"
//   SCRAPPY_HIDE_ON_BLUR="0" to keep the panel open when it loses focus
//   SCRAPPY_USER_DATA="/some/folder" to keep settings and draft apart from the real ones
const HOTKEY = process.env.SCRAPPY_HOTKEY ?? 'Control+Alt+Space'
const LEVEL: 'floating' | 'screen-saver' =
  process.env.SCRAPPY_LEVEL === 'screen-saver' ? 'screen-saver' : 'floating'
const HIDE_ON_BLUR = process.env.SCRAPPY_HIDE_ON_BLUR !== '0'

if (process.env.SCRAPPY_USER_DATA) app.setPath('userData', process.env.SCRAPPY_USER_DATA)

const PANEL_WIDTH = 520
const PANEL_HEIGHT = 220
const MAX_NOTE_CHARS = 1_000_000
const DEFAULT_VAULT = join(homedir(), 'Scrappy')
// Watcher events this soon after our own write to a file are ours, not external.
const OWN_WRITE_WINDOW_MS = 2000

// Settings and the capture draft live in the app data folder, never in the vault.
const settingsFile = (): string => join(app.getPath('userData'), 'settings.json')
const draftFile = (): string => join(app.getPath('userData'), 'capture-draft.md')

let settings: Settings = { vaultPath: null }
let watcher: VaultWatcher | null = null
const ownWrites = new Map<string, number>()

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
    width: 960,
    height: 640,
    minWidth: 640,
    minHeight: 400,
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

function requireVault(): string {
  if (!settings.vaultPath) throw new Error('No vault folder set.')
  return settings.vaultPath
}

/** Send the current note list to the main window, if it is open. */
async function pushNotes(external: string[] = []): Promise<void> {
  if (!mainWindow || !settings.vaultPath) return
  try {
    const change: NotesChanged = { notes: await listNotes(settings.vaultPath), external }
    mainWindow?.webContents.send(Channels.notesChanged, change)
  } catch (error) {
    console.error('[scrappy] could not list notes', error)
  }
}

function markOwnWrite(filename: string): void {
  ownWrites.set(filename, Date.now())
}

function isOwnWrite(filename: string): boolean {
  const at = ownWrites.get(filename)
  if (at === undefined) return false
  if (Date.now() - at < OWN_WRITE_WINDOW_MS) return true
  ownWrites.delete(filename)
  return false
}

async function startWatching(): Promise<void> {
  await watcher?.close()
  watcher = null
  ownWrites.clear()
  const vaultPath = settings.vaultPath
  if (!vaultPath || !(await isDirectory(vaultPath))) return
  watcher = watchVault(vaultPath, (filenames) => {
    void pushNotes(filenames.filter((filename) => !isOwnWrite(filename)))
  })
}

async function setVault(path: string): Promise<void> {
  settings = { ...settings, vaultPath: path }
  await saveSettings(settingsFile(), settings)
  await startWatching()
  mainWindow?.webContents.send(Channels.vaultChanged, vaultStatus())
  await pushNotes()
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
    markOwnWrite(filename)
    await writeFileAtomic(draftFile(), '')
    hidePanel()
    void pushNotes()
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
    ipcMain.handle(Channels.notesList, () =>
      settings.vaultPath ? listNotes(settings.vaultPath) : [],
    )
    ipcMain.handle(Channels.notesRead, (_event, filename: unknown) => {
      if (!isNoteFilename(filename)) throw new Error('Not a note filename.')
      return readNote(requireVault(), filename)
    })
    ipcMain.handle(Channels.notesWrite, async (_event, filename: unknown, text: unknown) => {
      if (!isNoteFilename(filename)) throw new Error('Not a note filename.')
      if (typeof text !== 'string' || text.length > MAX_NOTE_CHARS) {
        throw new Error('Note is not valid text or is too large.')
      }
      markOwnWrite(filename)
      await writeNote(requireVault(), filename, text)
      markOwnWrite(filename)
      void pushNotes()
    })
    ipcMain.handle(Channels.notesCreate, async () => {
      const filename = await createNote(requireVault(), '')
      markOwnWrite(filename)
      await pushNotes()
      return filename
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
    } else {
      await startWatching()
    }
  })

  app.on('before-quit', () => {
    quitting = true
  })

  // Keep running with no windows so the hotkey still works.
  app.on('window-all-closed', () => {})

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    void watcher?.close()
  })
}
