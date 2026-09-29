import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyBinding } from '@codemirror/view'
import { Editor, type EditorHandle } from '../editor/Editor'

const DRAFT_SAVE_DELAY_MS = 300

export function Capture() {
  const editorRef = useRef<EditorHandle>(null)
  const draftTimer = useRef<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void window.scrappy.getDraft().then((draft) => {
      // Keep anything typed before the draft arrived.
      if (!cancelled && draft !== '' && editorRef.current?.getText() === '') {
        editorRef.current.setText(draft)
      }
    })
    editorRef.current?.focus()
    const unsubscribe = window.scrappy.onCaptureShown(() => editorRef.current?.focus())
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const keys = useMemo<KeyBinding[]>(() => {
    const flushDraft = (): void => {
      window.clearTimeout(draftTimer.current)
      void window.scrappy.setDraft(editorRef.current?.getText() ?? '')
    }
    return [
      {
        key: 'Escape',
        run: () => {
          flushDraft()
          void window.scrappy.hideCapture()
          return true
        },
      },
      {
        key: 'Mod-Enter',
        run: () => {
          window.clearTimeout(draftTimer.current)
          const text = editorRef.current?.getText() ?? ''
          void window.scrappy.submitCapture(text).then((result) => {
            if (result.ok) {
              setError(null)
              if (result.filename) editorRef.current?.setText('')
            } else {
              setError(result.error)
            }
          })
          return true
        },
      },
    ]
  }, [])

  function onChange(text: string) {
    window.clearTimeout(draftTimer.current)
    draftTimer.current = window.setTimeout(() => {
      void window.scrappy.setDraft(text)
    }, DRAFT_SAVE_DELAY_MS)
  }

  return (
    <div className="capture">
      <Editor ref={editorRef} keys={keys} onChange={onChange} placeholderText="Capture a scrap" />
      <footer className={error ? 'error' : undefined}>
        {error ?? 'Cmd+Enter to save, Esc to hide'}
      </footer>
    </div>
  )
}
