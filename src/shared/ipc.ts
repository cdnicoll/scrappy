// Single source for IPC channel names and payloads.
// Main and preload both import from here so they cannot drift.

import type { NoteSummary } from './notes'

export const Channels = {
  notesList: 'notes:list',
  notesRead: 'notes:read',
  notesWrite: 'notes:write',
  notesCreate: 'notes:create',
  notesSearch: 'notes:search',
  notesTrash: 'notes:trash',
  notesChanged: 'notes:changed',
  captureHide: 'capture:hide',
  captureSubmit: 'capture:submit',
  captureShown: 'capture:shown',
  draftGet: 'draft:get',
  draftSet: 'draft:set',
  vaultChoose: 'vault:choose',
  prefsGet: 'prefs:get',
  prefsSetHotkey: 'prefs:set-hotkey',
  prefsSetLaunchAtLogin: 'prefs:set-launch-at-login',
  prefsChanged: 'prefs:changed',
  commandTake: 'command:take',
  command: 'command',
} as const

export interface HotkeyStatus {
  accelerator: string
  /** False when another app owns the shortcut. */
  registered: boolean
}

export interface Preferences {
  vaultPath: string | null
  hotkey: HotkeyStatus
  launchAtLogin: boolean
  /** False in development: the login item only works in the packaged app. */
  launchAtLoginActive: boolean
}

export type SetHotkeyResult = { ok: true } | { ok: false; error: string }

/** Actions started from the menu bar or app menu, carried out by the main window. */
export type AppCommand = 'new-note' | 'preferences'

export interface NotesChanged {
  /** The full list, newest first. */
  notes: NoteSummary[]
  /** Files changed by something other than Scrappy since the last push. */
  external: string[]
}

export type SubmitResult = { ok: true; filename: string | null } | { ok: false; error: string }

type Unsubscribe = () => void

export interface ScrappyApi {
  // Capture panel
  /** Hide the capture panel. The draft stays. */
  hideCapture(): Promise<void>
  /**
   * Save the text as a new note and hide the panel.
   * Empty text writes nothing and returns a null filename.
   */
  submitCapture(text: string): Promise<SubmitResult>
  onCaptureShown(callback: () => void): Unsubscribe
  getDraft(): Promise<string>
  setDraft(text: string): Promise<void>

  // Notes
  listNotes(): Promise<NoteSummary[]>
  readNote(filename: string): Promise<string>
  writeNote(filename: string, text: string): Promise<void>
  /** Create an empty note and return its filename. */
  createNote(): Promise<string>
  /** Filenames of notes whose title or body contains the text, case insensitive. */
  searchNotes(query: string): Promise<string[]>
  /** Ask to confirm, then move the note to the Trash. False when cancelled. */
  trashNote(filename: string): Promise<boolean>
  onNotesChanged(callback: (change: NotesChanged) => void): Unsubscribe

  // Preferences
  getPreferences(): Promise<Preferences>
  /** Open the folder picker. The result arrives through onPreferencesChanged. */
  chooseVault(): Promise<void>
  setHotkey(accelerator: string): Promise<SetHotkeyResult>
  setLaunchAtLogin(enabled: boolean): Promise<void>
  onPreferencesChanged(callback: (preferences: Preferences) => void): Unsubscribe

  // Commands from the menu bar and app menu
  /** A command issued before this window was ready, if any. */
  takePendingCommand(): Promise<AppCommand | null>
  onCommand(callback: (command: AppCommand) => void): Unsubscribe
}
