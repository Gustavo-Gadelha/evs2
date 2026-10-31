"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { loadColumns, loadTables } from "../client";
import { buildIndex, search, type SearchIndex } from "../search";
import type { QueryState } from "@/lib/sql/query-state";
import type { DictionaryEntry } from "@/lib/types";

type Suggest = (query: string) => DictionaryEntry[];
type DictionaryApi = { tables: Suggest; columns: Suggest };

const DictionaryContext = createContext<DictionaryApi>({ tables: () => [], columns: () => [] });

// Sugestões (até 50, prefixo primeiro) de tabelas e de colunas (`ALIAS.COLUNA`) do dicionário.
export const useDictionary = () => useContext(DictionaryContext);

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

// Fornece o autocomplete de tabelas e colunas do dicionário do Sankhya. Falhar só tira as sugestões.
export function Dictionary({ state, children }: { state: QueryState; children: React.ReactNode }) {
  const [tables, setTables] = useState<DictionaryEntry[]>([]);
  const [columns, setColumns] = useState<DictionaryEntry[]>([]);
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
        (await loadColumns(table)).map((column) => ({ name: `${prefix}.${column.name}`, description: column.description })),
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

  const api = useMemo<DictionaryApi>(() => {
    const tableIndex: SearchIndex = buildIndex(tables);
    const columnIndex: SearchIndex = buildIndex(columns);
    return { tables: (query) => search(tableIndex, query), columns: (query) => search(columnIndex, query) };
  }, [tables, columns]);

  return (
    <DictionaryContext value={api}>
      {error && <p className="text-xs text-muted-foreground">Sugestões do dicionário indisponíveis: {error}</p>}
      {children}
    </DictionaryContext>
  );
}
