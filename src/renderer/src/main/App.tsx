import { useCallback, useEffect, useRef, useState } from 'react'
import type { HotkeyStatus, NotesChanged, VaultStatus } from '../../../shared/ipc'
import type { NoteSummary } from '../../../shared/notes'
import { Editor, type EditorHandle } from '../editor/Editor'
import { Sidebar } from './Sidebar'

const AUTOSAVE_DELAY_MS = 500

interface PendingSave {
  filename: string
  text: string
  timer: number
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export function App() {
  const [hotkey, setHotkey] = useState<HotkeyStatus | null>(null)
  const [vault, setVault] = useState<VaultStatus | null>(null)
  const [notes, setNotes] = useState<NoteSummary[]>([])
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
        editorRef.current?.focus()
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
      await openNote(await window.scrappy.createNote())
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

  useEffect(() => {
    void window.scrappy.getHotkeyStatus().then(setHotkey)
    void window.scrappy.getVault().then(setVault)
    void window.scrappy.listNotes().then(setNotes)
    const stopVault = window.scrappy.onVaultChanged(setVault)
    const stopNotes = window.scrappy.onNotesChanged(onNotesChanged)
    return () => {
      stopVault()
      stopNotes()
    }
  }, [onNotesChanged])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        void newNote()
      }
    }
    const onUnload = (): void => void flush()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [newNote, flush])

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
    setVault(await window.scrappy.chooseVault())
  }

  const hasVault = Boolean(vault?.path)

  return (
    <div className="app">
      <div className="panes">
        <Sidebar
          notes={notes}
          selected={selected}
          onSelect={(filename) => void openNote(filename)}
          onNew={() => void newNote()}
        />
        <main>
          <div className={selected ? 'editor-pane' : 'editor-pane hidden'}>
            <Editor ref={editorRef} onChange={onEditorChange} placeholderText="Start typing" />
          </div>
          {!selected && (
            <div className="empty-state">
              {vault && !hasVault ? (
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
        {hotkey && !hotkey.registered && (
          <span className="error">
            Hotkey {hotkey.accelerator} failed to register. Another app owns it.
          </span>
        )}
        <span className="vault" title={vault?.path ?? undefined}>
          {vault?.path ?? 'No vault folder'}
        </span>
        <button onClick={() => void chooseVault()}>Change</button>
      </footer>
    </div>
  )
}
