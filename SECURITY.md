# Security

Scrappy is a local app. It has no server, no account and no network access of its own. The things worth protecting are the notes on your disk and the boundary between the app's web content and your machine.

## Reporting a problem

Please do not open a public issue for a security problem.

Use GitHub's private reporting instead: [Report a vulnerability](https://github.com/cdnicoll/scrappy/security/advisories/new). Only the maintainer sees it. Include the macOS version, the Scrappy version, and steps to reproduce.

This is a one person side project. Expect an acknowledgement within a week, and a fix in the next release once one is confirmed.

## What counts

- Anything that lets web content in a Scrappy window reach Node, the file system, or a shell.
- Anything that lets Scrappy read or write outside the vault folder and its own settings folder.
- Anything that deletes a note outright instead of moving it to the Trash.
- A crafted note or filename that breaks the app or escapes its expected behaviour.

## Design notes for reviewers

- Every window runs with `contextIsolation`, `sandbox` and without `nodeIntegration`.
- The renderer reaches the main process only through the typed API in `src/preload/index.ts`. Every payload is validated in `src/main/index.ts` before use.
- Note filenames are checked so they cannot leave the vault folder. See `isNoteFilename` in `src/main/vault.ts`.
- Pages carry a Content Security Policy that allows only bundled scripts.
