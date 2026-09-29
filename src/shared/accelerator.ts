// Electron accelerator strings for the capture hotkey. Pure, no DOM or Node access.

export const DEFAULT_HOTKEY = 'Control+Alt+Space'

const CODE_TO_KEY: Record<string, string> = {
  Space: 'Space',
  Enter: 'Return',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
}

function keyFromCode(code: string): string | null {
  const letter = /^Key([A-Z])$/.exec(code)
  if (letter) return letter[1]
  const digit = /^Digit([0-9])$/.exec(code)
  if (digit) return digit[1]
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  return CODE_TO_KEY[code] ?? null
}

const KEYS = new Set([
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  ...Object.values(CODE_TO_KEY),
])
const MODIFIERS = ['Control', 'Alt', 'Shift', 'Command'] as const

export interface KeyPress {
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/**
 * Build an accelerator from a key press. Returns null while only modifiers
 * are held, for unknown keys, and for combinations isValidAccelerator rejects.
 */
export function acceleratorFromKeyPress(press: KeyPress): string | null {
  const key = keyFromCode(press.code)
  if (!key) return null
  const parts: string[] = []
  if (press.ctrlKey) parts.push('Control')
  if (press.altKey) parts.push('Alt')
  if (press.shiftKey) parts.push('Shift')
  if (press.metaKey) parts.push('Command')
  const accelerator = [...parts, key].join('+')
  return isValidAccelerator(accelerator) ? accelerator : null
}

/**
 * Modifiers in a fixed order, then one key. A global hotkey needs Control,
 * Alt or Command, so it cannot swallow plain typing. Function keys are exempt.
 */
export function isValidAccelerator(value: unknown): value is string {
  if (typeof value !== 'string') return false
  // The key itself may be '+', which this app does not offer, so a plain split is safe.
  const parts = value.split('+')
  const key = parts.pop()
  if (!key || !KEYS.has(key)) return false
  if (new Set(parts).size !== parts.length) return false
  if (!parts.every((part) => (MODIFIERS as readonly string[]).includes(part))) return false
  const strong = parts.some((part) => part !== 'Shift')
  return strong || /^F\d+$/.test(key)
}
