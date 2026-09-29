import { access, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const pad = (value: number): string => String(value).padStart(2, '0')

/** `YYYY-MM-DD-HHmmss.md` in local time. Set at creation, never renamed. */
export function noteFilename(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${day}-${time}.md`
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Write a new note into the vault and return its filename.
 * Writes a temp file in the same folder, then renames it, so a reader
 * never sees a half written note. The temp file is gone once this returns.
 */
export async function createNote(vaultPath: string, text: string, now = new Date()): Promise<string> {
  if (!(await isDirectory(vaultPath))) {
    throw new Error(`Vault folder not found: ${vaultPath}`)
  }

  // Two captures in the same second: move forward until the name is free.
  let date = now
  let filename = noteFilename(date)
  while (await exists(join(vaultPath, filename))) {
    date = new Date(date.getTime() + 1000)
    filename = noteFilename(date)
  }

  const content = text.endsWith('\n') ? text : `${text}\n`
  const temp = join(vaultPath, `.${filename}.tmp`)
  try {
    await writeFile(temp, content, { encoding: 'utf8', flag: 'wx' })
    await rename(temp, join(vaultPath, filename))
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
  return filename
}
