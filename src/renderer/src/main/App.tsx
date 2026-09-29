import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppCommand, NotesChanged, Preferences } from '../../../shared/ipc'
import type { NoteSummary } from '../../../shared/notes'
import { Editor, type EditorHandle } from '../editor/Editor'
import { PreferencesPane } from './PreferencesPane'
import { Sidebar } from './Sidebar'

const AUTOSAVE_DELAY_MS = 500

interface PendingSave {
  filename: string
  text: string
  timer: number
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export function App() {
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [showPreferences, setShowPreferences] = useState(false)
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [filter, setFilter] = useState('')
  /** Filenames matching the filter, or null when the filter is empty. */
  const [matches, setMatches] = useState<Set<string> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const editorRef = useRef<EditorHandle>(null)
  // Mirrors `selected` for callbacks that outlive a render.
  const selectedRef = useRef<string | null>(null)
  const pendingRef = useRef<PendingSave | null>(null)

  /** Write the pending edit now. Safe to call with nothing pending. */
  const flush = useCallback(async (): Promise<void> => {
    const pending = pendingRef.current
    if (!pending) return
    window.clearTimeout(pending.timer)
    pendingRef.current = null
    try {
      await window.scrappy.writeNote(pending.filename, pending.text)
      setError(null)
    } catch (caught) {
      setError(`Could not save ${pending.filename}: ${message(caught)}`)
    }
  }, [])

  const select = useCallback((filename: string | null): void => {
    selectedRef.current = filename
    setSelected(filename)
  }, [])

  const openNote = useCallback(
    async (filename: string): Promise<void> => {
      if (filename === selectedRef.current) return
      await flush()
      select(filename)
      try {
        const text = await window.scrappy.readNote(filename)
        // Ignore the result if another note was opened while this one loaded.
        if (selectedRef.current !== filename) return
        editorRef.current?.setText(text)
        setError(null)
      } catch (caught) {
        if (selectedRef.current === filename) select(null)
        setError(`Could not open ${filename}: ${message(caught)}`)
      }
    },
    [flush, select],
  )

  const newNote = useCallback(async (): Promise<void> => {
    try {
      await flush()
      setFilter('') // An empty note matches no filter text.
      await openNote(await window.scrappy.createNote())
      editorRef.current?.focus()
    } catch (caught) {
      setError(`Could not create a note: ${message(caught)}`)
    }
  }, [flush, openNote])

  const onNotesChanged = useCallback(
    ({ notes: next, external }: NotesChanged): void => {
      setNotes(next)
      const current = selectedRef.current
      if (!current) return

      if (!next.some((note) => note.filename === current)) {
        // The open note is gone. Drop any pending save so it is not recreated.
        if (pendingRef.current) window.clearTimeout(pendingRef.current.timer)
        pendingRef.current = null
        select(null)
        editorRef.current?.setText('')
        return
      }

      // Changed outside Scrappy. Unsaved local edits win: last write wins.
      if (external.includes(current) && !pendingRef.current) {
        void window.scrappy
          .readNote(current)
          .then((text) => {
            if (selectedRef.current !== current || pendingRef.current) return
            if (editorRef.current?.getText() !== text) {
              editorRef.current?.setText(text, { keepCursor: true })
            }
          })
          .catch((caught: unknown) => setError(`Could not reload ${current}: ${message(caught)}`))
      }
    },
    [select],
  )

  const trashSelected = useCallback(async (): Promise<void> => {
    const filename = selectedRef.current
    if (!filename) return
    try {
      // Save first, so the copy in the Trash has the latest text.
      await flush()
      await window.scrappy.trashNote(filename)
    } catch (caught) {
      setError(`Could not move ${filename} to the Trash: ${message(caught)}`)
    }
  }, [flush])

  const runCommand = useCallback(
    (command: AppCommand | null): void => {
      if (command === 'new-note') void newNote()
      if (command === 'preferences') setShowPreferences(true)
    },
    [newNote],
  )

  useEffect(() => {
    void window.scrappy.getPreferences().then(setPreferences)
    void window.scrappy.listNotes().then(setNotes)
    const stopPreferences = window.scrappy.onPreferencesChanged(setPreferences)
    const stopNotes = window.scrappy.onNotesChanged(onNotesChanged)
    return () => {
      stopPreferences()
      stopNotes()
    }
  }, [onNotesChanged])

  useEffect(() => {
    void window.scrappy.takePendingCommand().then(runCommand)
    return window.scrappy.onCommand(runCommand)
  }, [runCommand])

  // Re-run the filter when its text or the notes change.
  useEffect(() => {
    if (filter.trim() === '') {
      setMatches(null)
      return
    }
    let cancelled = false
    void window.scrappy
      .searchNotes(filter)
      .then((filenames) => {
        if (!cancelled) setMatches(new Set(filenames))
      })
      .catch((caught: unknown) => setError(`Could not filter: ${message(caught)}`))
    return () => {
      cancelled = true
    }
  }, [filter, notes])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Backspace' || !event.metaKey) return
      // In the editor or a text field, Cmd+Backspace deletes text.
      const focused = document.activeElement
      if (focused?.closest('.cm-editor, input, textarea, .overlay')) return
      event.preventDefault()
      void trashSelected()
    }
    const onUnload = (): void => void flush()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [trashSelected, flush])

  function onEditorChange(text: string): void {
    const filename = selectedRef.current
    if (!filename) return
    if (pendingRef.current) window.clearTimeout(pendingRef.current.timer)
    pendingRef.current = {
      filename,
      text,
      timer: window.setTimeout(() => void flush(), AUTOSAVE_DELAY_MS),
    }
  }

  async function chooseVault(): Promise<void> {
    // Save to the current vault before it changes.
    await flush()
    await window.scrappy.chooseVault()
  }

  const hasVault = Boolean(preferences?.vaultPath)
  const visibleNotes = matches ? notes.filter((note) => matches.has(note.filename)) : notes

  return (
    <div className="app">
      <div className="panes">
        <Sidebar
          notes={visibleNotes}
          selected={selected}
          filter={filter}
          onFilter={setFilter}
          onSelect={(filename) => void openNote(filename)}
          onNew={() => void newNote()}
        />
        <main>
          <div className={selected ? 'editor-pane' : 'editor-pane hidden'}>
            <Editor ref={editorRef} onChange={onEditorChange} placeholderText="Start typing" />
          </div>
          {!selected && (
            <div className="empty-state">
              {preferences && !hasVault ? (
                <button onClick={() => void chooseVault()}>Choose vault folder</button>
              ) : (
                <p>Select a note, or press Cmd+N</p>
              )}
            </div>
          )}
        </main>
      </div>
      <footer>
        {error && <span className="error">{error}</span>}
        {preferences && !preferences.hotkey.registered && (
          <span className="error">
            Hotkey {preferences.hotkey.accelerator} is taken by another app. Change it in
            Preferences.
          </span>
        )}
        <span className="vault" title={preferences?.vaultPath ?? undefined}>
          {preferences?.vaultPath ?? 'No vault folder'}
        </span>
      </footer>
      {showPreferences && preferences && (
        <PreferencesPane
          preferences={preferences}
          onChooseVault={() => void chooseVault()}
          onClose={() => setShowPreferences(false)}
        />
      )}
    </div>
  )
}
