# Scrappy

A quick capture notes app for macOS. Press a hotkey from anywhere, type, press `Cmd+Enter`, and the note is a Markdown file in a folder you own.

Scrappy exists because opening a new editor window to hold a scrap of text is fast, but the scraps get lost. Scrappy keeps them, as plain files, with no database and no account.

## What it does

- **Capture from anywhere.** `Ctrl+Option+Space` opens a small floating panel over whatever you are doing, including fullscreen apps on other Spaces. `Cmd+Enter` saves. `Esc` hides and keeps what you typed as a draft.
- **Plain files.** Every note is a `.md` file in a folder you pick. Edit them in any editor. Put the folder in git or a synced drive if you like. Scrappy notices outside changes.
- **A small main window.** Notes grouped by day, a filter box, and a Markdown editor with light inline styling that saves as you type.
- **Menu bar icon.** New capture, open the window, preferences, quit. Closing the window keeps the hotkey working.

## Install

Scrappy is not yet signed with an Apple developer certificate, so macOS will block the first launch of a downloaded copy.

1. Download `Scrappy.app` from the [releases page](https://github.com/cdnicoll/scrappy/releases), or build it yourself (see below).
2. Move it to `/Applications` and open it.
3. If macOS refuses, open System Settings, Privacy & Security, and click Open Anyway next to the Scrappy message. This is needed once.
4. On first launch, pick a folder for your notes. `~/Scrappy` is the default.

Apple Silicon only for now.

## Use

| Action | Key |
| --- | --- |
| Open or hide the capture panel, from any app | `Ctrl+Option+Space` |
| Save the capture | `Cmd+Enter` |
| Hide the capture and keep the draft | `Esc` |
| New note in the main window | `Cmd+N` |
| Move the selected note to the Trash | `Cmd+Backspace` with the note row focused |
| Preferences | `Cmd+,` |

Preferences hold the vault folder, the capture hotkey, launch at login, and whether to show the Dock icon.

## How notes are stored

- The vault is one folder. Notes are `.md` files directly in it. Scrappy never writes anything else there.
- New notes are named by creation time, `2026-09-29-143501.md`, and never renamed. The title shown in the list is the first non empty line of the file.
- The list is sorted by modified time. Editing a note moves it to the top.
- Deleting moves the file to the macOS Trash. Nothing is deleted outright.
- Settings and the capture draft live in `~/Library/Application Support/scrappy`, outside the vault.

## Build from source

Needs Node 22 or newer.

```
git clone https://github.com/cdnicoll/scrappy.git
cd scrappy
npm install
npm run dev        # run with hot reload
npm run package    # write dist/mac-arm64/Scrappy.app
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout, the rules, and the development knobs. The design is written down in [SPEC.md](SPEC.md).

## Built with

Electron, TypeScript, React, CodeMirror 6, chokidar, electron-vite, electron-builder.

## License

[MIT](LICENSE)
