# Scrappy

Mac quick capture notes app. Electron, TypeScript, React, CodeMirror 6. Personal side project, one user: me.

**The spec is the source of truth: [SPEC.md](SPEC.md).** Read it before any work. If a change goes beyond it, say so and ask before building. Anything under "Non goals" or "Later" is out of scope unless I ask.

## Rules

- Follow the build order in SPEC.md. Step 1 (hotkey plus a floating panel showing over a fullscreen app on another Space) is a spike: prove it before building anything else.
- Keep it small. No state library, no database, no UI kit. React state, plain CSS, `fs`.
- Notes are plain `.md` files in the vault folder. Never write anything else into the vault.
- Delete means `shell.trashItem`. Never hard delete a note.
- Electron security defaults on every window: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Renderer talks to main only through a typed preload API.
- Use the `electron-macos` skill for window, panel, hotkey, IPC and packaging work.
- Commit only when I ask. No code signing or notarization for MVP.

## Commands

- `npm run dev`: run the app with hot reload
- `npm run build`: typecheck, then build to `out/`
- `npm run typecheck`
- `npm run lint`
- `npx install-electron`: fetch the Electron binary if `npm install` skipped it

Spike knobs for `npm run dev`: `SCRAPPY_HOTKEY`, `SCRAPPY_LEVEL` (`floating` or `screen-saver`), `SCRAPPY_HIDE_ON_BLUR=0`, `SCRAPPY_USER_DATA` (separate settings folder, for testing against a scratch vault).

## Layout

- `src/main/index.ts`: main process. Windows, capture panel, global hotkey, IPC handlers.
- `src/main/settings.ts`: settings JSON in the app data folder. `src/main/vault.ts`: list, read, and atomic writes of notes. `src/main/watcher.ts`: chokidar watch on the vault.
- `src/preload/index.ts`: typed API exposed as `window.scrappy`.
- `src/shared/ipc.ts`: IPC channel names and payload types. `src/shared/notes.ts`: title, preview, and day label helpers.
- `src/renderer/index.html` and `src/renderer/src/main/`: main window.
- `src/renderer/src/editor/`: CodeMirror editor shared by both windows.
- `src/renderer/capture.html` and `src/renderer/src/capture/`: capture panel.

## Voice

Direct. No emojis. Short answers, lead with the next action.
