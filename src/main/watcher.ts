import { watch } from 'chokidar'
import { basename } from 'node:path'
import { isNoteFilename } from './vault'

const DEBOUNCE_MS = 100

export interface VaultWatcher {
  close(): Promise<void>
}

/**
 * Watch the top level of the vault for `.md` changes.
 * Calls back with the changed filenames, batched.
 */
export function watchVault(
  vaultPath: string,
  onChange: (filenames: string[]) => void,
): VaultWatcher {
  const changed = new Set<string>()
  let timer: NodeJS.Timeout | undefined

  const queue = (path: string): void => {
    const filename = basename(path)
    if (!isNoteFilename(filename)) return
    changed.add(filename)
    clearTimeout(timer)
    timer = setTimeout(() => {
      const batch = [...changed]
      changed.clear()
      onChange(batch)
    }, DEBOUNCE_MS)
  }

  const watcher = watch(vaultPath, {
    depth: 0,
    ignoreInitial: true,
    ignored: (path, stats) => Boolean(stats?.isFile()) && !isNoteFilename(basename(path)),
  })
  watcher.on('add', queue).on('change', queue).on('unlink', queue)
  watcher.on('error', (error) => console.error('[scrappy] watcher error', error))
  return {
    close: async () => {
      clearTimeout(timer)
      await watcher.close()
    },
  }
}
