import { access, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { composeNote, parseNote } from '../shared/frontmatter'
import { summarize, type NoteSummary } from '../shared/notes'
import type { NoteContent, TagCount } from '../shared/ipc'

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

export async function readNote(vaultPath: string, filename: string): Promise<NoteContent> {
  const { body, tags } = parseNote(await readFile(notePath(vaultPath, filename), 'utf8'))
  return { body, tags }
}

/**
 * Overwrite an existing note through a temp file and rename.
 * Front matter lines other than tags are carried over from the file on disk.
 */
export async function writeNote(
  vaultPath: string,
  filename: string,
  content: NoteContent,
): Promise<void> {
  const target = notePath(vaultPath, filename)
  let extra: string[] = []
  try {
    extra = parseNote(await readFile(target, 'utf8')).extra
  } catch {
    // Missing or unreadable: write a fresh block.
  }
  const text = composeNote({ ...content, extra })
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
  tags: string[]
  /** Lower cased body text, for the filter. */
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
          const { body, tags } = parseNote(await readFile(path, 'utf8'))
          entry = {
            mtimeMs: info.mtimeMs,
            size: info.size,
            tags,
            body: body.toLowerCase(),
            ...summarize(body),
          }
          summaryCache.set(path, entry)
        }
        return {
          filename,
          title: entry.title,
          preview: entry.preview,
          tags: entry.tags,
          mtimeMs: entry.mtimeMs,
        }
      } catch {
        return null // Removed between readdir and stat.
      }
    }),
  )

  return notes
    .filter((note): note is NoteSummary => note !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs || b.filename.localeCompare(a.filename))
}

/**
 * Filenames matching the filter. Words starting with `#` must each match a tag
 * by prefix. Whatever is left must appear in the body or in a tag.
 */
export async function searchNotes(vaultPath: string, query: string): Promise<string[]> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const tagPrefixes = words.filter((w) => w.startsWith('#')).map((w) => w.slice(1)).filter(Boolean)
  const needle = words.filter((w) => !w.startsWith('#')).join(' ')
  const notes = await listNotes(vaultPath)
  return notes
    .filter((note) => {
      const entry = summaryCache.get(join(vaultPath, note.filename))
      if (!entry) return false
      const tagsOk = tagPrefixes.every((prefix) => entry.tags.some((tag) => tag.startsWith(prefix)))
      const textOk =
        needle === '' || entry.body.includes(needle) || entry.tags.some((tag) => tag.includes(needle))
      return tagsOk && textOk
    })
    .map((note) => note.filename)
}

/** Every tag in the vault with its note count, most used first, then alphabetical. */
export async function listTags(vaultPath: string): Promise<TagCount[]> {
  const counts = new Map<string, number>()
  for (const note of await listNotes(vaultPath)) {
    for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
