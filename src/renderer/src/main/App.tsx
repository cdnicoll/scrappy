import { useEffect, useState } from 'react'
import type { HotkeyStatus, VaultStatus } from '../../../shared/ipc'

// Placeholder. The real two pane window is step 3.
export function App() {
  const [hotkey, setHotkey] = useState<HotkeyStatus | null>(null)
  const [vault, setVault] = useState<VaultStatus | null>(null)

  useEffect(() => {
    void window.scrappy.getHotkeyStatus().then(setHotkey)
    void window.scrappy.getVault().then(setVault)
    return window.scrappy.onVaultChanged(setVault)
  }, [])

  return (
    <main>
      <h1>Scrappy</h1>
      {hotkey && (
        <p className={hotkey.registered ? 'ok' : 'error'}>
          Hotkey {hotkey.accelerator}:{' '}
          {hotkey.registered ? 'registered' : 'failed to register, another app owns it'}
        </p>
      )}
      {vault && (
        <p className={vault.path ? 'ok' : 'error'}>Vault: {vault.path ?? 'not set'}</p>
      )}
      <button onClick={() => void window.scrappy.chooseVault().then(setVault)}>
        Choose vault folder
      </button>
    </main>
  )
}
