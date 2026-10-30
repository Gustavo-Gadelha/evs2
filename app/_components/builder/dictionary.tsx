"use client";

import { useEffect, useMemo, useState } from "react";

import { loadColumns, loadTables } from "@/lib/dictionary";
import type { QueryState } from "@/lib/sql/query-state";
import type { DictionaryEntry } from "@/lib/types";

// `id`s dos <datalist> que os campos do builder referenciam em `list`.
export const TABLES_LIST = "dictionary-tables";
export const COLUMNS_LIST = "dictionary-columns";

type Option = { value: string; label: string };

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Tabelas usadas no FROM/JOINS que existem no dicionário, com o prefixo (alias ou nome) das colunas.
function usedTables(state: QueryState, known: Set<string>) {
  const refs = [state.from, ...state.joins.filter((join) => !join.off)];
  const seen = new Map<string, string>();
  for (const { table, alias } of refs) {
    const name = table.trim().toUpperCase().split(".").pop() ?? "";
    if (known.has(name)) seen.set(alias.trim().toUpperCase() || name, name);
  }
  return [...seen];
}

// Autocomplete de tabelas e colunas do dicionário do Sankhya, via <datalist> nativo. Falhar só tira as sugestões.
export function Dictionary({ state, children }: { state: QueryState; children: React.ReactNode }) {
  const [tables, setTables] = useState<DictionaryEntry[]>([]);
  const [columns, setColumns] = useState<Option[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTables().then(setTables, (err) => setError(messageOf(err)));
  }, []);

  const known = useMemo(() => new Set(tables.map((table) => table.name)), [tables]);
  const used = usedTables(state, known);
  const usedKey = used.map(([prefix, table]) => `${prefix}=${table}`).join(",");

  useEffect(() => {
    let cancelled = false;
    const pairs = usedKey ? usedKey.split(",").map((pair) => pair.split("=")) : [];
    Promise.all(
      pairs.map(async ([prefix, table]) =>
        (await loadColumns(table)).map((column) => ({ value: `${prefix}.${column.name}`, label: column.description })),
      ),
    ).then(
      (options) => {
        if (cancelled) return;
        setColumns(options.flat());
        setError(null);
      },
      (err) => {
        if (!cancelled) setError(messageOf(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [usedKey]);

  return (
    <>
      <datalist id={TABLES_LIST}>
        {tables.map((table) => (
          <option key={table.name} value={table.name} label={table.description} />
        ))}
      </datalist>
      <datalist id={COLUMNS_LIST}>
        {columns.map((column) => (
          <option key={column.value} value={column.value} label={column.label} />
        ))}
      </datalist>
      {error && <p className="text-xs text-zinc-500">Sugestões do dicionário indisponíveis: {error}</p>}
      {children}
    </>
  );
}
