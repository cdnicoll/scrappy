# Changelog

All notable changes to Scrappy. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-09-30

First release.

### Added

- Global hotkey, `Ctrl+Option+Space` by default, that opens a floating capture panel over any app, including fullscreen apps on other Spaces.
- `Cmd+Enter` saves the capture as a Markdown file in the vault folder. `Esc` hides the panel and keeps the text as a draft, which survives relaunches.
- Vault folder chosen on first launch, `~/Scrappy` by default, and changeable in Preferences.
- Main window with notes grouped by day, a filter over titles and body text, and a Markdown editor with light inline styling and fenced code highlighting.
- Autosave about half a second after typing stops.
- Watcher that picks up files added, changed or removed outside the app.
- `Cmd+N` for a new note, `Cmd+Backspace` to move the selected note to the Trash after confirming.
- Menu bar icon with New capture, Open Scrappy, Preferences and Quit. Closing the window keeps the app running.
- Preferences for the vault folder, the capture hotkey, launch at login, and showing the Dock icon.
- `Tab` indents in both editors.
- Unsigned Apple Silicon build, published as a zip on each `v*` tag.

[Unreleased]: https://github.com/cdnicoll/scrappy/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cdnicoll/scrappy/releases/tag/v0.1.0
