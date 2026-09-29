import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap, placeholder, type KeyBinding } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import './editor.css'

export interface EditorHandle {
  getText(): string
  setText(text: string): void
  focus(): void
}

interface EditorProps {
  ref?: Ref<EditorHandle>
  placeholderText?: string
  /** Extra key bindings. They win over the defaults. Read once, at mount. */
  keys?: readonly KeyBinding[]
  onChange?: (text: string) => void
}

// Light inline styling only: the text stays Markdown source.
const markdownStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.3em' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.15em' },
  { tag: tags.heading, fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.monospace, class: 'cm-inline-code' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.processingInstruction, opacity: '0.5' },
  { tag: [tags.keyword, tags.operatorKeyword], class: 'cm-code-keyword' },
  { tag: [tags.string, tags.special(tags.string)], class: 'cm-code-string' },
  { tag: [tags.comment], class: 'cm-code-comment' },
  { tag: [tags.number, tags.bool, tags.null], class: 'cm-code-number' },
])

export function Editor({ ref, placeholderText, keys, onChange }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const keysRef = useRef(keys)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: '',
        extensions: [
          Prec.highest(keymap.of([...(keysRef.current ?? [])])),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(markdownStyle),
          EditorView.lineWrapping,
          placeholder(placeholderText ?? ''),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // The view is created once. Text changes go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    getText: () => viewRef.current?.state.doc.toString() ?? '',
    setText: (text: string) => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: text.length },
      })
    },
    focus: () => viewRef.current?.focus(),
  }))

  return <div className="editor" ref={hostRef} />
}
