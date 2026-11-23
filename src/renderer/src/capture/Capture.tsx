import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyBinding } from '@codemirror/view'
import { composeNote, parseNote } from '../../../shared/frontmatter'
import { Editor, type EditorHandle } from '../editor/Editor'
import { TagBar, type TagBarHandle } from '../tags/TagBar'

const DRAFT_SAVE_DELAY_MS = 300

export function Capture() {
  const editorRef = useRef<EditorHandle>(null)
  const tagBarRef = useRef<TagBarHandle>(null)
  const draftTimer = useRef<number | undefined>(undefined)
  const [tags, setTags] = useState<string[]>([])
  const tagsRef = useRef<string[]>([])
  const [known, setKnown] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const refreshKnown = (): void => {
    void window.scrappy.listTags().then((counts) => setKnown(counts.map((c) => c.tag)))
  }

  useEffect(() => {
    let cancelled = false
    void window.scrappy.getDraft().then((draft) => {
      // Keep anything typed before the draft arrived.
      if (cancelled || draft === '' || editorRef.current?.getText() !== '') return
      const parts = parseNote(draft)
      // composeNote adds a final newline for the file on disk. Not wanted in the editor.
      editorRef.current?.setText(parts.body.replace(/\n$/, ''))
      tagsRef.current = parts.tags
      setTags(parts.tags)
    })
    refreshKnown()
    editorRef.current?.focus()
    const unsubscribe = window.scrappy.onCaptureShown(() => {
      refreshKnown()
      editorRef.current?.focus()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  function saveDraftSoon(): void {
    window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => void saveDraftNow(), DRAFT_SAVE_DELAY_MS)
  }

  function saveDraftNow(): Promise<void> {
    window.clearTimeout(draftTimer.current)
    const body = editorRef.current?.getText() ?? ''
    const draft = body === '' && tagsRef.current.length === 0 ? '' : composeNote({ tags: tagsRef.current, body })
    return window.scrappy.setDraft(draft)
  }

  function hide(): void {
    void saveDraftNow()
    void window.scrappy.hideCapture()
  }

  function submit(withTags: string[] = tagsRef.current): void {
    window.clearTimeout(draftTimer.current)
    const text = editorRef.current?.getText() ?? ''
    void window.scrappy.submitCapture(text, withTags).then((result) => {
      if (result.ok) {
        setError(null)
        if (result.filename) {
          editorRef.current?.setText('')
          tagsRef.current = []
          setTags([])
        }
      } else {
        setError(result.error)
      }
    })
  }

  function onTagsChange(next: string[]): void {
    tagsRef.current = next
    setTags(next)
    saveDraftSoon()
  }

  const keys = useMemo<KeyBinding[]>(
    () => [
      { key: 'Escape', run: () => (hide(), true) },
      { key: 'Mod-Enter', run: () => (submit(), true) },
      { key: 'Mod-t', run: () => (tagBarRef.current?.focus(), true) },
    ],
    // These only touch refs, so one set of bindings for the editor's lifetime is right.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <div className="capture">
      <Editor ref={editorRef} keys={keys} onChange={saveDraftSoon} placeholderText="Capture a scrap" />
      <footer className={error ? 'error' : undefined}>
        <TagBar
          ref={tagBarRef}
          tags={tags}
          onChange={onTagsChange}
          suggestions={known}
          onEscape={hide}
          onSubmit={submit}
        />
        <span className="hint">{error ?? 'Cmd+Enter saves, Cmd+T tags, Esc hides'}</span>
      </footer>
    </div>
  )
}
