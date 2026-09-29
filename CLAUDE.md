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

Filled in after scaffolding. Expected: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`.

## Layout

Filled in after scaffolding. Expected: `src/main` (main process), `src/preload`, `src/renderer` (React, two entries: main window and capture panel), `src/shared` (types for IPC).

## Voice

Direct. No emojis. Short answers, lead with the next action.
