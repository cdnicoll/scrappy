// Single source for IPC channel names and payloads.
// Main and preload both import from here so they cannot drift.

export const Channels = {
  captureHide: 'capture:hide',
  captureSubmit: 'capture:submit',
  captureShown: 'capture:shown',
  hotkeyStatus: 'hotkey:status',
} as const

export interface HotkeyStatus {
  accelerator: string
  registered: boolean
}

export interface ScrappyApi {
  /** Hide the capture panel. The renderer keeps its text as the draft. */
  hideCapture(): Promise<void>
  /** Submit the capture text. Step 1 only logs it; step 2 writes to the vault. */
  submitCapture(text: string): Promise<void>
  /** Fires each time the panel is shown. Returns an unsubscribe function. */
  onCaptureShown(callback: () => void): () => void
  getHotkeyStatus(): Promise<HotkeyStatus>
}
