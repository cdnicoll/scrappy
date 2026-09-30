# Contributing to Scrappy

Thanks for looking. Scrappy is a small app with a written spec, and the goal is to keep it small.

## Before you build anything

- **Read [SPEC.md](SPEC.md).** It is the source of truth for what Scrappy does and does not do.
- **Open an issue first** for anything not in the spec, and for anything listed under Non goals or Later. A short note on what you want and why is enough. This saves you building something that will not be merged.
- Bug fixes and small improvements within the spec can go straight to a pull request.

## Rules of the codebase

- **Keep it small.** No state library, no database, no UI kit. React state, plain CSS, and Node `fs`.
- **Notes are plain `.md` files in the vault folder.** Never write anything else into the vault. Temp files used for atomic writes must be gone before a write returns.
- **Delete means the macOS Trash**, through `shell.trashItem`. Never hard delete a note.
- **Electron security defaults on every window:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The renderer talks to the main process only through the typed API in `src/preload`, with the channel names and payload types in `src/shared/ipc.ts`. Validate every payload in the main process.
- **All file access lives in the main process.**

## Setup

Needs Node 22 or newer and macOS. The app is macOS only.

```
npm install
npm run dev
```

If `npm install` did not fetch the Electron binary, run `npx install-electron`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the app with hot reload |
| `npm run typecheck` | Type check the main, preload and renderer code |
| `npm run lint` | ESLint |
| `npm run build` | Typecheck, then build to `out/` |
| `npm run package` | Build, then write `dist/mac-arm64/Scrappy.app` with an ad hoc signature |

Run typecheck and lint before opening a pull request. There is no automated test suite yet. Test by hand against the acceptance list in SPEC.md, and say in the pull request which items you checked.

## Development knobs

Environment variables for `npm run dev`, so you can try variants without editing code:

| Variable | Effect |
| --- | --- |
| `SCRAPPY_USER_DATA=/some/folder` | Keep settings and the draft apart from your real ones. Use this with a scratch vault when testing. |
| `SCRAPPY_HOTKEY="Control+Alt+Shift+F11"` | Use a different hotkey for this run, so it does not clash with an installed Scrappy. |
| `SCRAPPY_LEVEL=screen-saver` | Raise the capture panel's window level, if it ever hides behind a fullscreen app. |
| `SCRAPPY_HIDE_ON_BLUR=0` | Keep the panel open when it loses focus, which helps when debugging it. |

Only one Scrappy can hold a given hotkey. Quit an installed copy, or use `SCRAPPY_HOTKEY`, before running from source.

## Layout

```
src/main/index.ts        Main process: windows, capture panel, hotkey, tray, app menu, IPC handlers
src/main/settings.ts     Settings JSON in the app data folder
src/main/vault.ts        List, read, create, and atomic writes of notes; the filter
src/main/watcher.ts      chokidar watch on the vault folder
src/preload/index.ts     The typed API exposed to the renderer as window.scrappy
src/shared/ipc.ts        IPC channel names and payload types
src/shared/notes.ts      Title, preview, and day label helpers
src/shared/accelerator.ts Hotkey strings
src/renderer/index.html, src/renderer/src/main/      Main window
src/renderer/capture.html, src/renderer/src/capture/ Capture panel
src/renderer/src/editor/ CodeMirror editor shared by both windows
resources/               Menu bar template icon, and the script that draws it
```

## Pull requests

- One change per pull request.
- Describe what changed and how you tested it.
- Add a line under Unreleased in [CHANGELOG.md](CHANGELOG.md) for anything a user would notice.
- Keep the voice of the app: direct, no emojis.

## Security

Found something that looks like a security problem? See [SECURITY.md](SECURITY.md) and report it privately.

## Working with Claude Code

The repo carries a `CLAUDE.md` and a `.claude` folder with an Electron on macOS skill. They are for people who use Claude Code on this codebase. You do not need them to contribute.
