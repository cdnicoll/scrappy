import { useEffect, useState, type KeyboardEvent } from 'react'
import { acceleratorFromKeyPress } from '../../../shared/accelerator'
import type { Preferences } from '../../../shared/ipc'

interface PreferencesPaneProps {
  preferences: Preferences
  onChooseVault: () => void
  onClose: () => void
}

/** `Control+Alt+Space` reads better as `Control + Option + Space` on a Mac. */
function displayHotkey(accelerator: string): string {
  return accelerator.split('+').map((part) => (part === 'Alt' ? 'Option' : part)).join(' + ')
}

export function PreferencesPane({ preferences, onChooseVault, onClose }: PreferencesPaneProps) {
  const [recording, setRecording] = useState(false)
  const [hotkeyError, setHotkeyError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape' && !recording) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [recording, onClose])

  function onHotkeyKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!recording) return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') {
      setRecording(false)
      return
    }
    const accelerator = acceleratorFromKeyPress(event.nativeEvent)
    if (!accelerator) return // Only modifiers so far, or a key that cannot be used.
    setRecording(false)
    void window.scrappy.setHotkey(accelerator).then((result) => {
      setHotkeyError(result.ok ? null : result.error)
    })
  }

  const { hotkey } = preferences

  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="preferences"
        role="dialog"
        aria-label="Preferences"
        onClick={(event) => event.stopPropagation()}
      >
        <h1>Preferences</h1>

        <div className="field">
          <span className="label">Vault folder</span>
          <span className="value path" title={preferences.vaultPath ?? undefined}>
            {preferences.vaultPath ?? 'Not set'}
          </span>
          <button onClick={onChooseVault}>Change</button>
        </div>

        <div className="field">
          <span className="label">Capture hotkey</span>
          <button
            className={recording ? 'value hotkey recording' : 'value hotkey'}
            onClick={() => {
              setHotkeyError(null)
              setRecording(true)
            }}
            onKeyDown={onHotkeyKeyDown}
            onBlur={() => setRecording(false)}
          >
            {recording ? 'Press the new shortcut, Esc to cancel' : displayHotkey(hotkey.accelerator)}
          </button>
        </div>
        {hotkeyError && <p className="error">{hotkeyError}</p>}
        {!hotkeyError && !hotkey.registered && (
          <p className="error">
            {displayHotkey(hotkey.accelerator)} is taken by another app. Pick a different one.
          </p>
        )}

        <label className="field">
          <span className="label">Launch at login</span>
          <input
            type="checkbox"
            checked={preferences.launchAtLogin}
            onChange={(event) => void window.scrappy.setLaunchAtLogin(event.target.checked)}
          />
        </label>
        {!preferences.launchAtLoginActive && (
          <p className="hint">Saved, but it only takes effect in the packaged app.</p>
        )}

        <label className="field">
          <span className="label">Show Dock icon</span>
          <input
            type="checkbox"
            checked={preferences.showDockIcon}
            onChange={(event) => void window.scrappy.setShowDockIcon(event.target.checked)}
          />
        </label>
        {!preferences.showDockIcon && (
          <p className="hint">Open Scrappy from the menu bar icon.</p>
        )}

        <footer>
          <button onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  )
}
