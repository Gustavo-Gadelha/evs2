"use client";

import { useEffect, useMemo, useRef } from "react";
import { PLSQL, sql as sqlLanguage, type SQLNamespace } from "@codemirror/lang-sql";
import CodeMirror, { EditorView, Prec, Transaction, keymap, type ViewUpdate } from "@uiw/react-codemirror";

import { formatSql, mapCursor } from "@/lib/sql/format";

// Formata o SQL depois de o usuário parar de digitar.
const FORMAT_DELAY_MS = 600;
const FORMAT_EVENT = "format.sql";

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "12px" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace", padding: "8px 0" },
  ".cm-scroller": { lineHeight: "1.625" },
  ".cm-gutters": { display: "none" },
});

// Ctrl/Cmd+Enter roda a consulta (listener da página); sem isto o editor inseriria uma linha em branco.
const runKey = Prec.highest(keymap.of([{ key: "Mod-Enter", run: () => true }]));

function formatNow(view: EditorView) {
  const before = view.state.doc.toString();
  const after = formatSql(before);
  if (after === null) return;
  view.dispatch({
    changes: { from: 0, to: before.length, insert: after },
    selection: { anchor: mapCursor(before, view.state.selection.main.head, after) },
    annotations: Transaction.userEvent.of(FORMAT_EVENT),
  });
}

type Props = {
  value: string;
  schema: SQLNamespace;
  placeholder?: string;
  onChange: (value: string) => void;
};

// Editor SQL (CodeMirror) com destaque Oracle, autocomplete do dicionário e formatação automática.
export function SqlCodeEditor({ value, schema, placeholder, onChange }: Props) {
  const view = useRef<EditorView | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const extensions = useMemo(
    () => [sqlLanguage({ dialect: PLSQL, schema, upperCaseKeywords: true }), theme, runKey, EditorView.lineWrapping],
    [schema],
  );

  // Só digitação e colagem do usuário agendam a formatação: mudanças vindas do builder, desfazer e a
  // própria formatação não.
  function onUpdate(update: ViewUpdate) {
    const typed = update.transactions.some(
      (tr) => tr.docChanged && (tr.isUserEvent("input") || tr.isUserEvent("delete")),
    );
    if (!typed) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => view.current && formatNow(view.current), FORMAT_DELAY_MS);
  }

  return (
    <CodeMirror
      aria-label="SQL"
      className="min-h-64 rounded-md border border-input bg-input/30 focus-within:border-ring"
      theme="dark"
      minHeight="16rem"
      value={value}
      placeholder={placeholder}
      extensions={extensions}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false }}
      onChange={onChange}
      onUpdate={onUpdate}
      onCreateEditor={(editor) => {
        view.current = editor;
      }}
    />
  );
}
