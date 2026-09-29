import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface Settings {
  vaultPath: string | null
}

const defaults: Settings = { vaultPath: null }

/** Read settings from a JSON file. A missing or broken file gives the defaults. */
export async function loadSettings(file: string): Promise<Settings> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return { ...defaults }
    const vaultPath = (parsed as Record<string, unknown>).vaultPath
    return { vaultPath: typeof vaultPath === 'string' && vaultPath !== '' ? vaultPath : null }
  } catch {
    return { ...defaults }
  }
}

export async function saveSettings(file: string, settings: Settings): Promise<void> {
  await writeFileAtomic(file, `${JSON.stringify(settings, null, 2)}\n`)
}

/** Write to a temp file beside the target, then rename over it. */
export async function writeFileAtomic(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  await writeFile(temp, content, 'utf8')
  await rename(temp, file)
}
