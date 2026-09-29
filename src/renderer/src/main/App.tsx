import { useEffect, useState } from 'react'
import type { HotkeyStatus } from '../../../shared/ipc'

// Step 1 placeholder. The real two pane window is step 3.
export function App() {
  const [status, setStatus] = useState<HotkeyStatus | null>(null)

  useEffect(() => {
    void window.scrappy.getHotkeyStatus().then(setStatus)
  }, [])

  return (
    <main>
      <h1>Scrappy</h1>
      <p>Step 1 spike: global hotkey and floating capture panel.</p>
      {status && (
        <p className={status.registered ? 'ok' : 'error'}>
          Hotkey {status.accelerator}:{' '}
          {status.registered ? 'registered' : 'failed to register, another app owns it'}
        </p>
      )}
    </main>
  )
}
