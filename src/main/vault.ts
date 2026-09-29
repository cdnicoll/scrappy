import { access, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { summarize, type NoteSummary } from '../shared/notes'

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

  const content = text === '' || text.endsWith('\n') ? text : `${text}\n`
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

/** A note is a visible `.md` file directly in the vault. Anything else is rejected. */
export function isNoteFilename(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.endsWith('.md') &&
    !name.startsWith('.') &&
    basename(name) === name &&
    !name.includes('\\')
  )
}

export function notePath(vaultPath: string, filename: string): string {
  if (!isNoteFilename(filename)) throw new Error(`Not a note filename: ${String(filename)}`)
  return join(vaultPath, filename)
}

export async function readNote(vaultPath: string, filename: string): Promise<string> {
  return readFile(notePath(vaultPath, filename), 'utf8')
}

/** Overwrite an existing note through a temp file and rename. */
export async function writeNote(vaultPath: string, filename: string, text: string): Promise<void> {
  const target = notePath(vaultPath, filename)
  const temp = join(vaultPath, `.${filename}.tmp`)
  try {
    await writeFile(temp, text, 'utf8')
    await rename(temp, target)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}

interface CacheEntry {
  mtimeMs: number
  size: number
  title: string
  preview: string
  /** Lower cased full text, for the filter. */
  body: string
}

// Summaries keyed by full path, reused while mtime and size are unchanged.
const summaryCache = new Map<string, CacheEntry>()

/** All notes in the vault, newest first. */
export async function listNotes(vaultPath: string): Promise<NoteSummary[]> {
  const entries = await readdir(vaultPath, { withFileTypes: true })
  const names = entries.filter((e) => e.isFile() && isNoteFilename(e.name)).map((e) => e.name)

  const notes = await Promise.all(
    names.map(async (filename): Promise<NoteSummary | null> => {
      const path = join(vaultPath, filename)
      try {
        const info = await stat(path)
        let entry = summaryCache.get(path)
        if (!entry || entry.mtimeMs !== info.mtimeMs || entry.size !== info.size) {
          const text = await readFile(path, 'utf8')
          entry = {
            mtimeMs: info.mtimeMs,
            size: info.size,
            body: text.toLowerCase(),
            ...summarize(text),
          }
          summaryCache.set(path, entry)
        }
        return { filename, title: entry.title, preview: entry.preview, mtimeMs: entry.mtimeMs }
      } catch {
        return null // Removed between readdir and stat.
      }
    }),
  )

  return notes
    .filter((note): note is NoteSummary => note !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.filename.localeCompare(a.filename))
}

/** Filenames of notes whose text contains the query, case insensitive. */
export async function searchNotes(vaultPath: string, query: string): Promise<string[]> {
  const needle = query.trim().toLowerCase()
  const notes = await listNotes(vaultPath)
  if (needle === '') return notes.map((note) => note.filename)
  return notes
    .filter((note) => summaryCache.get(join(vaultPath, note.filename))?.body.includes(needle))
    .map((note) => note.filename)
}
