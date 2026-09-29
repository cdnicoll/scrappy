---
name: electron-macos
description: Patterns for building Scrappy's Electron app on macOS. Use for any work on windows, the floating capture panel, global shortcuts, menu bar tray, IPC and preload, file watching, launch at login, or packaging.
---

# Electron on macOS for Scrappy

Check current Electron docs (context7) before relying on an API detail below; Electron changes often.

## Project shape

- Scaffold with electron-vite, React and TypeScript template: `npm create @quick-start/electron@latest`.
- Processes: `src/main` (Node, owns fs, windows, shortcuts), `src/preload` (exposes a small typed API), `src/renderer` (React, no Node access).
- Two renderer entries: `index.html` (main window) and `capture.html` (panel). Configure both in `electron.vite.config.ts`.
- Shared IPC types in `src/shared/ipc.ts`; main and preload import them so channel names and payloads cannot drift.

## Security defaults, every BrowserWindow

```ts
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

Preload exposes named functions only (`contextBridge.exposeInMainWorld('scrappy', {...})`). Never expose `ipcRenderer` itself. Use `ipcMain.handle` plus `ipcRenderer.invoke` for requests, `webContents.send` for main to renderer events.

## Capture panel

Create once in `app.whenReady`, keep hidden, show and hide. Never recreate per hotkey press (slow, loses the draft).

```ts
const panel = new BrowserWindow({
  width: 520, height: 220,
  type: 'panel',            // NSPanel: floats without activating the app
  frame: false,
  resizable: false,
  show: false,
  skipTaskbar: true,
  fullscreenable: false,
  hiddenInMissionControl: true,
  webPreferences: { /* security defaults */ },
})
panel.setAlwaysOnTop(true, 'floating')   // try 'screen-saver' if it hides behind fullscreen apps
panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
```

- Show: center on the display under the cursor (`screen.getDisplayNearestPoint(screen.getCursorScreenPoint())`), then `panel.showInactive()` or `show()` then `focus()`. Test both; the goal is typing works immediately and the user's Space does not change.
- Hide on `Esc`, on save, and on `blur`.
- Returning focus: after hide, macOS should return focus to the previous app. If the main window pops forward instead, call `app.hide()` when the main window is not visible.
- Dock: `app.dock.hide()` only if Scrappy runs as a menu bar app; otherwise keep the Dock icon for the main window. Decide in the spike.

This is the known risk. Test in the spike against: a fullscreen VS Code on another Space, a normal window on Space 2, and a second display.

## Global shortcut

```ts
globalShortcut.register(accel, togglePanel)   // returns false if taken
app.on('will-quit', () => globalShortcut.unregisterAll())
```

If `register` returns false, show that in Preferences; do not fail silently. Re-register when the setting changes.

## Menu bar and lifecycle

- `Tray` with a template image (`iconTemplate.png`, 16 and 32 px, black on transparent) so it follows light and dark mode.
- Keep running when windows close: handle `window-all-closed` and do nothing on macOS.
- `app.requestSingleInstanceLock()`; on second instance, show the main window.
- Launch at login: `app.setLoginItemSettings({ openAtLogin: true })`. Only takes effect in the packaged app.

## Vault and files

- All fs in main. Renderer asks through IPC.
- Folder picker: `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })`.
- Watch with `chokidar`, `depth: 0`, `ignoreInitial: true`, only `*.md`. Debounce and push list updates to the main window.
- Write atomically: write to a temp file in the same folder, then `fs.rename`. Ignore the watcher event for your own write (track recent paths) so the editor does not reload under the cursor.
- Delete: `shell.trashItem(path)`.

## CodeMirror 6 in React

- Use `@codemirror/view`, `@codemirror/state`, `@codemirror/lang-markdown`, and `@codemirror/language-data` for fenced code highlighting. A thin `useEffect` wrapper is enough; no wrapper library needed.
- Recreate state only when the open note changes, not on every save.
- Keybindings: add `Mod-Enter` (save capture) and `Escape` (close) via a high precedence keymap in the panel only.

## Packaging

- electron-builder, `mac.target: dmg` or `dir`, arm64. Unsigned for MVP; first open needs right click then Open.
- Set `LSUIElement` only if choosing the menu bar only mode.

## Verify before calling done

- `npm run typecheck` and `npm run lint` pass.
- Run the app and test the acceptance list in SPEC.md by hand. Say which items were checked and which were not.
