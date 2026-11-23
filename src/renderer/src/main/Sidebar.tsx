import type { TagCount } from '../../../shared/ipc'
import { dayLabel, type NoteSummary } from '../../../shared/notes'

interface SidebarProps {
  notes: NoteSummary[]
  selected: string | null
  filter: string
  onFilter: (text: string) => void
  tagCounts: TagCount[]
  /** Click on a tag chip: add or remove its `#tag` word in the filter. */
  onToggleTag: (tag: string) => void
  onSelect: (filename: string) => void
  onNew: () => void
}

interface DayGroup {
  label: string
  notes: NoteSummary[]
}

// Notes arrive newest first, so notes of one day are already adjacent.
function groupByDay(notes: NoteSummary[]): DayGroup[] {
  const now = new Date()
  const groups: DayGroup[] = []
  for (const note of notes) {
    const label = dayLabel(note.mtimeMs, now)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.notes.push(note)
    else groups.push({ label, notes: [note] })
  }
  return groups
}

const MAX_TAG_CHIPS = 24

export function Sidebar({
  notes,
  selected,
  filter,
  onFilter,
  tagCounts,
  onToggleTag,
  onSelect,
  onNew,
}: SidebarProps) {
  const activeTags = new Set(
    filter
      .split(/\s+/)
      .filter((w) => w.startsWith('#'))
      .map((w) => w.slice(1)),
  )

  return (
    <nav className="sidebar">
      <header>
        <span>Notes</span>
        <button onClick={onNew} title="New note (Cmd+N)" aria-label="New note">
          +
        </button>
      </header>
      <input
        className="filter"
        type="search"
        placeholder="Filter"
        aria-label="Filter notes"
        spellCheck={false}
        value={filter}
        onChange={(event) => onFilter(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onFilter('')
        }}
      />
      {tagCounts.length > 0 && (
        <div className="tag-row" aria-label="Filter by tag">
          {tagCounts.slice(0, MAX_TAG_CHIPS).map(({ tag, count }) => (
            <button
              key={tag}
              className={activeTags.has(tag) ? 'chip active' : 'chip'}
              title={`${count} ${count === 1 ? 'note' : 'notes'}`}
              onClick={() => onToggleTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      <div className="list">
        {notes.length === 0 && (
          <p className="empty">{filter.trim() === '' ? 'No notes yet' : 'No matches'}</p>
        )}
        {groupByDay(notes).map((group) => (
          <section key={group.label}>
            <h2>{group.label}</h2>
            {group.notes.map((note) => (
              <button
                key={note.filename}
                className={note.filename === selected ? 'row selected' : 'row'}
                onClick={() => onSelect(note.filename)}
              >
                <span className="title">{note.title}</span>
                <span className="preview">{note.preview || ' '}</span>
                {note.tags.length > 0 && (
                  <span className="tags">{note.tags.map((tag) => `#${tag}`).join(' ')}</span>
                )}
              </button>
            ))}
          </section>
        ))}
      </div>
    </nav>
  )
}
