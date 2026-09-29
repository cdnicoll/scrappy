import { dayLabel, type NoteSummary } from '../../../shared/notes'

interface SidebarProps {
  notes: NoteSummary[]
  selected: string | null
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

export function Sidebar({ notes, selected, onSelect, onNew }: SidebarProps) {
  return (
    <nav className="sidebar">
      <header>
        <span>Notes</span>
        <button onClick={onNew} title="New note (Cmd+N)" aria-label="New note">
          +
        </button>
      </header>
      <div className="list">
        {notes.length === 0 && <p className="empty">No notes yet</p>}
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
              </button>
            ))}
          </section>
        ))}
      </div>
    </nav>
  )
}
