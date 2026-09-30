# Scrappy: MVP spec

Status: MVP built and in daily use, 2026-09-29. This document is the source of truth for what Scrappy does. Changes beyond it need an issue first; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Problem

Through the day, scraps pile up in new editor windows: commands, snippets, quick notes. After about a week the windows get closed and the context is gone. Scrappy is a fast place to capture that stays.

## Goal

A Mac app that captures a scrap in under two seconds from anywhere, keeps it as a plain Markdown file, and lets you find and edit it later.

## Non goals (MVP)

- Sync, accounts, cloud anything
- Tags, folders, links between notes
- Rendered preview mode, themes, plugins
- iOS, Windows, Linux
- Search beyond a simple filter (see Later)

## Stack

- Electron, TypeScript, React
- CodeMirror 6 with Markdown language support and light inline styling (headings, bold, code) for both editors
- Electron Forge or electron-vite for build and packaging
- `electron-store` or a small JSON file for settings
- Node `fs` plus `chokidar` to watch the vault

## Storage: the vault

- A vault is a folder the user picks. Notes are `.md` files directly in it. No database, no index file.
- First launch: prompt to choose or create a folder. Default suggestion `~/Scrappy`.
- Vault path lives in settings. It can be changed in Preferences, and the app reloads from the new folder.
- Filename: `YYYY-MM-DD-HHmmss.md`, set at creation and never renamed. Title comes from content, not the filename.
- Title: the first non empty line, with leading `#` stripped, cut to 60 characters. Empty note shows "Untitled".
- Sort key: file modified time, newest first.
- External edits (VS Code, git, Finder) are picked up by the watcher. Last write wins; no conflict handling in MVP.

## Feature 1: Capture (the priority)

- Global hotkey, default `Ctrl+Option+Space`, configurable in Preferences.
- Opens a small floating panel (about 520 by 220) centered on the active screen, over the current app, including fullscreen apps and any Space. It does not switch Spaces or bring the main window forward.
- Panel holds one CodeMirror editor, focused, empty.
- `Cmd+Enter`: write a new note to the vault, clear, hide the panel.
- `Esc`: hide the panel. Unsaved text is kept as a draft and restored next time it opens.
- Empty content on save: just hide, write nothing.
- Hotkey pressed while the panel is open: hide it.
- Implementation: create the panel window once at startup and keep it hidden; show and hide it, never recreate it. Use `type: 'panel'`, `alwaysOnTop` at level `floating` or higher, `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`, frameless, not shown in the Dock or app switcher.

## Feature 2: Main window

- Two panes, like Bear: sidebar list on the left, editor on the right.
- Sidebar groups notes under day headers: Today, Yesterday, then dates (`Sep 26`). Each row shows the title and a single line preview.
- A filter box at the top of the sidebar matches titles and body text, case insensitive.
- Click a row to open the note in the editor. The editor autosaves about 500 ms after typing stops.
- `Cmd+N`: new empty note in the main window.
- `Cmd+Backspace` on a selected note: move the file to the macOS Trash (`shell.trashItem`), after a confirm. Never a hard delete.
- A newly captured note shows up at the top of the list right away.

## Feature 3: App shell

- Menu bar icon with: New capture, Open Scrappy, Preferences, Quit.
- Closing the main window keeps the app running so the hotkey still works.
- Launch at login, on by default (`app.setLoginItemSettings`).
- Preferences: vault folder, capture hotkey, launch at login, show Dock icon.
- Show Dock icon, on by default. When off, Scrappy has no Dock icon and is not in the app switcher; the menu bar icon is the way in. Added 2026-09-29, after the MVP build.

## Build order

1. Spike: global hotkey plus the floating panel showing over a fullscreen app on another Space. If this fails, stop and rethink before building anything else.
2. Vault: pick a folder, save the setting, write a note from the panel.
3. Main window: list, day headers, editor, autosave, watcher.
4. Filter, trash, menu bar, launch at login, preferences.
5. Package an unsigned `.app`.

## Acceptance

- From any app, including fullscreen VS Code, hotkey then typing then `Cmd+Enter` saves a file in the vault in under two seconds, and focus returns to where you were.
- The note shows at the top of the main window list with the right title.
- Editing in the main window changes the file on disk; editing the file in VS Code changes what the app shows.
- Changing the vault folder in Preferences reloads the list from the new folder.
- Quitting and relaunching loses nothing.

## Open questions

- Default hotkey: `Ctrl+Option+Space` is free on a stock Mac. It may collide with launchers or input source switching on some setups; the hotkey is configurable.
- Code signing and notarization: not in the MVP. Builds carry an ad hoc signature, so a downloaded copy needs Open Anyway in Privacy & Security once. Tracked as an issue.

## Later

- Full text search with ranking
- Rendered preview toggle
- Pin notes
- "Append to last note" option in the capture panel
- Export or archive old scraps
