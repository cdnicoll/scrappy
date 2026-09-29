// Pure helpers shared by main and renderer. No Node or DOM access here.

export const TITLE_MAX = 60
export const PREVIEW_MAX = 120

export interface NoteSummary {
  filename: string
  title: string
  preview: string
  /** File modified time in ms. The list sorts on this, newest first. */
  mtimeMs: number
}

/**
 * Title: first non empty line, leading `#` stripped, cut to 60 characters.
 * Preview: the next non empty line.
 */
export function summarize(text: string): { title: string; preview: string } {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
  const title = (lines[0] ?? '').replace(/^#+\s*/, '').slice(0, TITLE_MAX)
  const preview = (lines[1] ?? '').slice(0, PREVIEW_MAX)
  return { title: title === '' ? 'Untitled' : title, preview }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** Today, Yesterday, then `Sep 26`. Other years add the year. */
export function dayLabel(mtimeMs: number, now = new Date()): string {
  const date = new Date(mtimeMs)
  const today = startOfDay(now)
  const day = startOfDay(date)
  if (day === today) return 'Today'
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime()
  if (day === yesterday) return 'Yesterday'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}
