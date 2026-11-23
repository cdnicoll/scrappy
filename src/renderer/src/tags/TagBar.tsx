import { useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from 'react'
import { normalizeTag } from '../../../shared/frontmatter'
import './tagbar.css'

export interface TagBarHandle {
  focus(): void
}

interface TagBarProps {
  ref?: Ref<TagBarHandle>
  tags: string[]
  onChange: (tags: string[]) => void
  /** Every tag in the vault. Shown as suggestions, most used first. */
  suggestions: readonly string[]
  /** Escape with nothing typed and no suggestions open. */
  onEscape?: () => void
  /** Cmd+Enter. Any typed tag is added first. */
  onSubmit?: (tags: string[]) => void
}

const MAX_SHOWN = 8

/** Chips for the current tags, an input to add more, and suggestions from the vault. */
export function TagBar({ ref, tags, onChange, suggestions, onEscape, onSubmit }: TagBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))

  const typed = normalizeTag(text)
  const shown = suggestions
    .filter((tag) => !tags.includes(tag) && (typed === null || tag.startsWith(typed)))
    .slice(0, MAX_SHOWN)
  const visible = open && shown.length > 0

  function add(raw: string): string[] {
    const tag = normalizeTag(raw)
    const next = tag && !tags.includes(tag) ? [...tags, tag] : tags
    if (next !== tags) onChange(next)
    setText('')
    setHighlight(0)
    return next
  }

  function remove(tag: string): void {
    onChange(tags.filter((t) => t !== tag))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault()
      onSubmit?.(text.trim() ? add(text) : tags)
      return
    }
    switch (event.key) {
      case 'ArrowDown':
        if (!visible) {
          setOpen(true)
          return
        }
        event.preventDefault()
        setHighlight((h) => (h + 1) % shown.length)
        return
      case 'ArrowUp':
        if (!visible) return
        event.preventDefault()
        setHighlight((h) => (h - 1 + shown.length) % shown.length)
        return
      case 'Enter':
      case 'Tab':
      case ',': {
        const pick = visible ? shown[highlight] : text
        if (event.key === 'Tab' && !text.trim() && !visible) return // Let Tab move focus.
        event.preventDefault()
        if (pick?.trim()) add(pick)
        return
      }
      case 'Backspace':
        if (text === '' && tags.length > 0) {
          event.preventDefault()
          remove(tags[tags.length - 1])
        }
        return
      case 'Escape':
        if (visible) {
          event.preventDefault()
          setOpen(false)
          return
        }
        if (text === '') onEscape?.()
        else setText('')
        return
    }
  }

  return (
    <div className="tagbar" onClick={() => inputRef.current?.focus()}>
      {tags.map((tag) => (
        <span key={tag} className="chip">
          #{tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            onClick={(event) => {
              event.stopPropagation()
              remove(tag)
            }}
          >
            ×
          </button>
        </span>
      ))}
      <div className="tag-input">
        <input
          ref={inputRef}
          value={text}
          placeholder={tags.length === 0 ? 'Add tags' : ''}
          spellCheck={false}
          aria-label="Tags"
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {visible && (
          <ul className="suggestions" role="listbox">
            {shown.map((tag, i) => (
              <li
                key={tag}
                role="option"
                aria-selected={i === highlight}
                className={i === highlight ? 'active' : undefined}
                // Mouse down, not click, so the input keeps focus and blur does not close the list first.
                onMouseDown={(event) => {
                  event.preventDefault()
                  add(tag)
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                #{tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
