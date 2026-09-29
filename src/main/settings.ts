import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { DEFAULT_HOTKEY, isValidAccelerator } from '../shared/accelerator'

export interface Settings {
  vaultPath: string | null
  hotkey: string
  launchAtLogin: boolean
}

export const defaultSettings: Settings = {
  vaultPath: null,
  hotkey: DEFAULT_HOTKEY,
  launchAtLogin: true,
}

/** Read settings from a JSON file. Missing or invalid values fall back to the defaults. */
export async function loadSettings(file: string): Promise<Settings> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return { ...defaultSettings }
    const { vaultPath, hotkey, launchAtLogin } = parsed as Record<string, unknown>
    return {
      vaultPath: typeof vaultPath === 'string' && vaultPath !== '' ? vaultPath : null,
      hotkey: isValidAccelerator(hotkey) ? hotkey : defaultSettings.hotkey,
      launchAtLogin:
        typeof launchAtLogin === 'boolean' ? launchAtLogin : defaultSettings.launchAtLogin,
    }
  } catch {
    return { ...defaultSettings }
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
