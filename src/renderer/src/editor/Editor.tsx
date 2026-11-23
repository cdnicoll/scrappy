import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import {
  EditorSelection,
  EditorState,
  Prec,
  countColumn,
} from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  keymap,
  placeholder,
  type Command,
  type DecorationSet,
  type KeyBinding,
  type ViewUpdate,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  HighlightStyle,
  indentUnit,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import "./editor.css";

export interface EditorHandle {
  getText(): string;
  /**
   * Replace the document with a fresh state, so undo never crosses into
   * the previous document. Does not fire onChange.
   */
  setText(text: string, options?: { keepCursor?: boolean }): void;
  focus(): void;
}

interface EditorProps {
  ref?: Ref<EditorHandle>;
  placeholderText?: string;
  /** Extra key bindings. They win over the defaults. Read once, at mount. */
  keys?: readonly KeyBinding[];
  onChange?: (text: string) => void;
}

const INDENT = 4;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/;

/**
 * Tab in a list item, or with a selection, indents whole lines so bullets nest.
 * Otherwise it inserts spaces up to the next tab stop, at the cursor.
 */
const insertSoftTab: Command = (view) => {
  const { state } = view;
  const onListItem = state.selection.ranges.some((range) =>
    LIST_ITEM.test(state.doc.lineAt(range.head).text),
  );
  if (onListItem || state.selection.ranges.some((range) => !range.empty)) {
    return indentMore(view);
  }
  view.dispatch(
    state.changeByRange((range) => {
      const line = state.doc.lineAt(range.head);
      const column = countColumn(
        line.text,
        state.tabSize,
        range.head - line.from,
      );
      const width = INDENT - (column % INDENT);
      return {
        changes: { from: range.head, insert: " ".repeat(width) },
        range: EditorSelection.cursor(range.head + width),
      };
    }),
    { scrollIntoView: true, userEvent: "input" },
  );
  return true;
};

const HEADING_NODE = /^(?:ATX|Setext)Heading(\d)$/;

/** Marks each heading line with its level, so the whole line, `#` included, gets sized. */
function headingDecorations(view: EditorView): DecorationSet {
  const marks: { from: number; deco: Decoration }[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const level = HEADING_NODE.exec(node.name)?.[1];
        if (!level) return;
        const first = view.state.doc.lineAt(node.from).number;
        const last = view.state.doc.lineAt(node.to).number;
        for (let n = first; n <= last; n++) {
          marks.push({
            from: view.state.doc.line(n).from,
            deco: Decoration.line({
              class: `cm-line-heading cm-line-h${level}`,
            }),
          });
        }
      },
    });
  }
  return Decoration.set(
    marks.map((mark) => mark.deco.range(mark.from)),
    true,
  );
}

const headingLines = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = headingDecorations(view);
    }
    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        syntaxTree(update.state) !== syntaxTree(update.startState)
      ) {
        this.decorations = headingDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const tabKeymap: KeyBinding[] = [
  { key: "Tab", run: insertSoftTab, shift: indentLess },
];

// Light inline styling only: the text stays Markdown source.
// Colours live in editor.css, keyed by these classes, so they follow the theme.
// A class rule ignores its other properties, so sizes come from headingLines.
const markdownStyle = HighlightStyle.define([
  { tag: tags.heading, class: "cm-md-heading" },
  { tag: tags.strong, class: "cm-md-strong" },
  { tag: tags.emphasis, class: "cm-md-emphasis" },
  { tag: tags.monospace, class: "cm-inline-code" },
  { tag: tags.link, class: "cm-md-link" },
  { tag: tags.processingInstruction, class: "cm-md-mark" },
  { tag: [tags.keyword, tags.operatorKeyword], class: "cm-code-keyword" },
  { tag: [tags.string, tags.special(tags.string)], class: "cm-code-string" },
  { tag: [tags.comment], class: "cm-code-comment" },
  { tag: [tags.number, tags.bool, tags.null], class: "cm-code-number" },
]);

export function Editor({ ref, placeholderText, keys, onChange }: EditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const keysRef = useRef(keys);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const createState = useRef((doc: string, cursor: number): EditorState =>
    EditorState.create({
      doc,
      selection: { anchor: Math.min(cursor, doc.length) },
      extensions: [
        Prec.highest(keymap.of([...(keysRef.current ?? [])])),
        history(),
        indentUnit.of(" ".repeat(INDENT)),
        keymap.of([...tabKeymap, ...defaultKeymap, ...historyKeymap]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(markdownStyle),
        headingLines,
        EditorView.lineWrapping,
        placeholder(placeholderText ?? ""),
        EditorView.updateListener.of((update) => {
          if (update.docChanged)
            onChangeRef.current?.(update.state.doc.toString());
        }),
      ],
    }),
  );

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: createState.current("", 0),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getText: () => viewRef.current?.state.doc.toString() ?? "",
    setText: (text, options) => {
      const view = viewRef.current;
      if (!view) return;
      const cursor = options?.keepCursor
        ? view.state.selection.main.head
        : text.length;
      view.setState(createState.current(text, cursor));
    },
    focus: () => viewRef.current?.focus(),
  }));

  return <div className="editor" ref={hostRef} />;
}
