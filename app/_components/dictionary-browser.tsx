"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { loadColumns, loadTables } from "@/lib/dictionary";
import { normalize } from "@/lib/dictionary-search";
import type { DictionaryEntry } from "@/lib/types";

const MAX_ROWS = 300;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// "contém", sem diferenciar maiúsculas nem acentos (mesma regra do filtro da tabela de resultado).
function filterEntries(entries: DictionaryEntry[], query: string): DictionaryEntry[] {
  const needle = normalize(query.trim());
  if (!needle) return entries;
  return entries.filter((entry) => normalize(`${entry.name} ${entry.description}`).includes(needle));
}

function EntryList({
  entries,
  selected,
  onSelect,
}: {
  entries: DictionaryEntry[];
  selected?: string | null;
  onSelect?: (name: string) => void;
}) {
  return (
    <ul className="flex flex-col">
      {entries.slice(0, MAX_ROWS).map((entry) => (
        <li key={entry.name}>
          <button
            type="button"
            disabled={!onSelect}
            className={`flex w-full flex-col items-start rounded px-2 py-1 text-left enabled:hover:bg-zinc-800 ${
              selected === entry.name ? "bg-zinc-800" : ""
            }`}
            onClick={() => onSelect?.(entry.name)}
          >
            <span className="font-mono text-xs text-zinc-100">{entry.name}</span>
            {entry.description && <span className="text-xs text-zinc-400">{entry.description}</span>}
          </button>
        </li>
      ))}
      {entries.length > MAX_ROWS && (
        <li className="px-2 py-1 text-xs text-zinc-500">
          Mostrando {MAX_ROWS} de {entries.length}: refine a busca.
        </li>
      )}
      {entries.length === 0 && <li className="px-2 py-1 text-xs text-zinc-500">Nada encontrado.</li>}
    </ul>
  );
}

// Navegador do dicionário usado no autocomplete: busca tabelas e, ao escolher uma, filtra suas colunas.
export function DictionaryBrowser({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tables, setTables] = useState<DictionaryEntry[] | null>(null);
  const [columns, setColumns] = useState<DictionaryEntry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tableQuery, setTableQuery] = useState("");
  const [columnQuery, setColumnQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    loadTables().then(setTables, (err) => setError(messageOf(err)));
  }, []);

  function select(name: string) {
    setSelected(name);
    setColumns(null);
    setColumnQuery("");
    loadColumns(name).then(
      (entries) => setColumns((current) => (current === null ? entries : current)),
      (err) => setError(messageOf(err)),
    );
  }

  const visibleTables = useMemo(() => filterEntries(tables ?? [], tableQuery), [tables, tableQuery]);
  const visibleColumns = useMemo(() => filterEntries(columns ?? [], columnQuery), [columns, columnQuery]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && dialog.current.close()}
      className="m-auto h-[80vh] w-[min(56rem,95vw)] rounded-lg border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="label">Dicionário do Sankhya</h2>
          {tables && <span className="text-xs text-zinc-500">{tables.length} tabelas</span>}
          <button type="button" className="btn-ghost ml-auto" aria-label="Fechar" onClick={() => dialog.current?.close()}>
            ✕
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          <section className="flex min-h-0 flex-col gap-2">
            <input
              autoFocus
              className="input"
              placeholder="Buscar tabela por nome ou descrição"
              value={tableQuery}
              onChange={(event) => setTableQuery(event.target.value)}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              {tables === null && !error ? (
                <p className="px-2 text-xs text-zinc-500">Carregando…</p>
              ) : (
                <EntryList entries={visibleTables} selected={selected} onSelect={select} />
              )}
            </div>
          </section>
          <section className="flex min-h-0 flex-col gap-2">
            <input
              className="input"
              placeholder={selected ? `Buscar coluna em ${selected}` : "Escolha uma tabela"}
              disabled={!selected}
              value={columnQuery}
              onChange={(event) => setColumnQuery(event.target.value)}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              {selected && columns === null && !error && <p className="px-2 text-xs text-zinc-500">Carregando…</p>}
              {columns && <EntryList entries={visibleColumns} />}
            </div>
          </section>
        </div>
      </div>
    </dialog>
  );
}
