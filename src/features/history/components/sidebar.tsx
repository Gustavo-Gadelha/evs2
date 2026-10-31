"use client";

import { MAX_HISTORY, type HistoryItem, type SavedQuery } from "../history";
import { SaveForm } from "./save-form";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  history: HistoryItem[];
  saved: SavedQuery[];
  onLoadHistory: (entry: HistoryItem) => void;
  onLoadSaved: (query: SavedQuery) => void;
  onSaveHistory: (name: string, entry: HistoryItem) => void;
  onRemoveSaved: (id: string) => void;
  onClearHistory: () => void;
  onNewQuery: () => void;
};

function oneLine(sql: string): string {
  return sql.replace(/\s+/g, " ").trim() || "(vazio)";
}

function ItemButton({ label, title, onClick }: { label: string; title?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="min-w-0 flex-1 truncate rounded px-2 py-1 text-left text-sm hover:bg-accent"
      title={title}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function Sidebar(props: Props) {
  const { history, saved, onLoadHistory, onLoadSaved, onSaveHistory, onRemoveSaved, onClearHistory, onNewQuery } = props;

  return (
    <aside className="flex flex-col gap-6 border-border p-4 lg:row-span-2 lg:border-r xl:row-span-1">
      <Button variant="outline" size="sm" type="button" className="w-full" onClick={onNewQuery}>
        <PlusIcon data-icon="inline-start" />
        Nova consulta
      </Button>

      <section className="flex flex-col gap-2">
        <h2 className="label">Consultas salvas</h2>
        {saved.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma ainda.</p>}
        <ul className="flex flex-col gap-1">
          {saved.map((query) => (
            <li key={query.id} className="group flex items-center gap-1">
              <ItemButton label={query.name} title={query.sql} onClick={() => onLoadSaved(query)} />
              <Button
                variant="ghost" size="xs"
                type="button"
                className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label={`Excluir ${query.name}`}
                onClick={() => onRemoveSaved(query.id)}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="label">Histórico ({history.length}/{MAX_HISTORY})</h2>
          <Button variant="ghost" size="xs" type="button" disabled={history.length === 0} onClick={onClearHistory}>
            Limpar
          </Button>
        </div>
        {history.length === 0 && <p className="text-xs text-muted-foreground">Vazio.</p>}
        <ul className="flex flex-col gap-1">
          {history.map((entry) => (
            <li key={entry.id} className="rounded hover:bg-accent">
              <button type="button" className="w-full px-2 pt-1 text-left" title={entry.sql} onClick={() => onLoadHistory(entry)}>
                <div className="flex items-center gap-2 font-mono text-xs">
                  {entry.error === null ? (
                    <span className="text-emerald-400">{entry.rowCount} linha(s)</span>
                  ) : (
                    <span className="text-destructive">erro</span>
                  )}
                  <span className="ml-auto text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString("pt-BR")}</span>
                </div>
                <div className="truncate font-mono text-xs text-foreground">{oneLine(entry.sql)}</div>
              </button>
              <div className="px-2 pb-1">
                <SaveForm label="salvar como consulta" onSave={(name) => onSaveHistory(name, entry)} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
