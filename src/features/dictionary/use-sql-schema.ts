"use client";

import { useEffect, useMemo, useState } from "react";
import type { SQLNamespace } from "@codemirror/lang-sql";
import { toast } from "sonner";

import { loadColumns, loadTables, subscribeDictionary } from "./client";
import type { DictionaryEntry } from "@/lib/types";

const MAX_TABLES_WITH_COLUMNS = 12;
const WORD = /[A-Z_][A-Z0-9_$#]*/g;

function warn(err: unknown) {
  toast.warning("Sugestões do dicionário indisponíveis", {
    id: "dictionary-suggest",
    description: err instanceof Error ? err.message : String(err),
  });
}

// Esquema do autocomplete do editor: todas as tabelas do dicionário e, para as que o SQL cita, as colunas
// (o editor resolve os aliases do FROM/JOIN). Falhar só tira as sugestões.
export function useSqlSchema(sql: string): SQLNamespace {
  const [tables, setTables] = useState<DictionaryEntry[]>([]);
  const [columns, setColumns] = useState<Record<string, DictionaryEntry[]>>({});
  // Sobe a cada invalidação do dicionário, para recarregar tabelas e colunas.
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      subscribeDictionary(() => {
        setColumns({});
        setVersion((value) => value + 1);
      }),
    [],
  );

  useEffect(() => {
    loadTables().then(setTables, warn);
  }, [version]);

  const known = useMemo(() => new Set(tables.map((table) => table.name)), [tables]);
  const used = useMemo(() => {
    const words = sql.toUpperCase().match(WORD) ?? [];
    return [...new Set(words.filter((word) => known.has(word)))].slice(0, MAX_TABLES_WITH_COLUMNS).sort().join(",");
  }, [sql, known]);

  useEffect(() => {
    for (const name of used ? used.split(",") : []) {
      loadColumns(name).then((list) => setColumns((current) => ({ ...current, [name]: list })), warn);
    }
  }, [used, version]);

  return useMemo(() => {
    const schema: Record<string, SQLNamespace> = {};
    for (const table of tables) {
      schema[table.name] = {
        self: { label: table.name, detail: table.description, type: "class" },
        children: (columns[table.name] ?? []).map((column) => ({
          label: column.name,
          detail: column.description,
          type: "property",
        })),
      };
    }
    return schema;
  }, [tables, columns]);
}
