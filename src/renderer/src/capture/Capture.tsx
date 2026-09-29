import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

// Step 1 spike: a plain textarea stands in for CodeMirror.
// The panel window is never recreated, so this state is the draft.
export function Capture() {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    return window.scrappy.onCaptureShown(() => inputRef.current?.focus())
  }, [])

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      void window.scrappy.hideCapture()
      return
    }
    if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault()
      if (text.trim() === '') {
        void window.scrappy.hideCapture()
        return
      }
      void window.scrappy.submitCapture(text).then(() => setText(''))
    }
  }

  return (
    <div className="capture">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Capture a scrap"
        spellCheck={false}
      />
      <footer>Cmd+Enter to save, Esc to hide</footer>
    </div>
  )
}
