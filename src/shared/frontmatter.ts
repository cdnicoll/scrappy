// Every note Scrappy writes starts with a YAML front matter block:
//
//   ---
//   tags: [work, ci]
//   ---
//   # Title
//
// Only `tags` is understood. Other lines inside the block are kept as they are.
// Notes without a block, for example ones created in another editor, read as
// having no tags, and gain a block the next time Scrappy saves them.

export interface NoteParts {
  tags: string[]
  /** The note text after the front matter block. */
  body: string
  /** Front matter lines other than `tags`, kept verbatim. */
  extra: string[]
}

export const MAX_TAGS = 50
export const MAX_TAG_LENGTH = 50

/**
 * Lower case, `#` and spaces stripped, letters, digits, `-` and `_` only.
 * Returns null when nothing usable is left.
 */
export function normalizeTag(input: string): string | null {
  const tag = input
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^-+|-+$/g, '')
  return tag === '' || tag.length > MAX_TAG_LENGTH ? null : tag
}

/** Normalize, drop blanks and duplicates, keep order. */
export function normalizeTags(input: readonly string[]): string[] {
  const seen = new Set<string>()
  for (const raw of input) {
    const tag = normalizeTag(raw)
    if (tag) seen.add(tag)
  }
  return [...seen].slice(0, MAX_TAGS)
}

const unquote = (value: string): string => value.trim().replace(/^(['"])(.*)\1$/, '$2')

function parseTagValue(value: string): string[] | null {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '[]') return []
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map(unquote)
      .filter((tag) => tag !== '')
  }
  // `tags: work, ci` or `tags: work`
  return trimmed.split(',').map(unquote)
}

/** Split a file into front matter tags, other front matter lines, and the body. */
export function parseNote(raw: string): NoteParts {
  const lines = raw.split('\n')
  if (lines[0] !== '---') return { tags: [], body: raw, extra: [] }
  const end = lines.indexOf('---', 1)
  if (end === -1) return { tags: [], body: raw, extra: [] }

  const extra: string[] = []
  let tags: string[] = []
  for (let i = 1; i < end; i++) {
    const line = lines[i]
    const inline = /^tags:(.*)$/.exec(line)
    if (inline) {
      const value = parseTagValue(inline[1])
      if (value !== null && inline[1].trim() !== '') {
        tags = value
        continue
      }
      // Block list form: `tags:` followed by `  - work` lines.
      const items: string[] = []
      while (i + 1 < end && /^\s+-\s*/.test(lines[i + 1])) {
        items.push(unquote(lines[i + 1].replace(/^\s+-\s*/, '')))
        i++
      }
      tags = items
      continue
    }
    extra.push(line)
  }
  return {
    tags: normalizeTags(tags),
    body: lines.slice(end + 1).join('\n'),
    extra,
  }
}

/** Build the file text. The front matter block is always present. */
export function composeNote(parts: { tags: readonly string[]; body: string; extra?: readonly string[] }): string {
  const tags = normalizeTags(parts.tags)
  const header = ['---', ...(parts.extra ?? []), `tags: [${tags.join(', ')}]`, '---']
  const body = parts.body === '' || parts.body.endsWith('\n') ? parts.body : `${parts.body}\n`
  return `${header.join('\n')}\n${body}`
}
