// Single source for IPC channel names and payloads.
// Main and preload both import from here so they cannot drift.

export const Channels = {
  captureHide: 'capture:hide',
  captureSubmit: 'capture:submit',
  captureShown: 'capture:shown',
  draftGet: 'draft:get',
  draftSet: 'draft:set',
  hotkeyStatus: 'hotkey:status',
  vaultGet: 'vault:get',
  vaultChoose: 'vault:choose',
  vaultChanged: 'vault:changed',
} as const

export interface HotkeyStatus {
  accelerator: string
  registered: boolean
}

export interface VaultStatus {
  /** Absolute path of the vault folder, or null when none is set. */
  path: string | null
}

export type SubmitResult = { ok: true; filename: string | null } | { ok: false; error: string }

export interface ScrappyApi {
  /** Hide the capture panel. The draft stays. */
  hideCapture(): Promise<void>
  /**
   * Save the text as a new note and hide the panel.
   * Empty text writes nothing and returns a null filename.
   */
  submitCapture(text: string): Promise<SubmitResult>
  /** Fires each time the panel is shown. Returns an unsubscribe function. */
  onCaptureShown(callback: () => void): () => void
  getDraft(): Promise<string>
  setDraft(text: string): Promise<void>
  getHotkeyStatus(): Promise<HotkeyStatus>
  getVault(): Promise<VaultStatus>
  /** Open the folder picker. Resolves with the vault after the user picks or cancels. */
  chooseVault(): Promise<VaultStatus>
  /** Fires when the vault folder changes. Returns an unsubscribe function. */
  onVaultChanged(callback: (status: VaultStatus) => void): () => void
}
