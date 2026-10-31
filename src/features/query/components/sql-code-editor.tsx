"use client";

import { useMemo } from "react";
import { PLSQL, sql as sqlLanguage, type SQLNamespace } from "@codemirror/lang-sql";
import CodeMirror, { EditorView, Prec, keymap } from "@uiw/react-codemirror";

const theme = EditorView.theme({
  "&": { backgroundColor: "transparent", fontSize: "12px" },
  "&.cm-focused": { outline: "none" },
  ".cm-content": { fontFamily: "var(--font-geist-mono), ui-monospace, monospace", padding: "8px 0" },
  ".cm-scroller": { lineHeight: "1.625" },
  ".cm-gutters": { display: "none" },
});

// Ctrl/Cmd+Enter roda a consulta (listener da página); sem isto o editor inseriria uma linha em branco.
const runKey = Prec.highest(keymap.of([{ key: "Mod-Enter", run: () => true }]));

type Props = {
  value: string;
  schema: SQLNamespace;
  placeholder?: string;
  onChange: (value: string) => void;
};

// Editor SQL (CodeMirror) com destaque Oracle e autocomplete do dicionário.
export function SqlCodeEditor({ value, schema, placeholder, onChange }: Props) {
  const extensions = useMemo(
    () => [sqlLanguage({ dialect: PLSQL, schema, upperCaseKeywords: true }), theme, runKey, EditorView.lineWrapping],
    [schema],
  );

  return (
    <CodeMirror
      aria-label="SQL"
      className="min-h-64 rounded-md border border-input bg-input/30 focus-within:border-ring"
      theme="dark"
      minHeight="16rem"
      value={value}
      placeholder={placeholder}
      extensions={extensions}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      onChange={onChange}
    />
  );
}
