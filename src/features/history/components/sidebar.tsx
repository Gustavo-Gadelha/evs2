"use client";

import { MAX_HISTORY, type HistoryItem, type SavedQuery } from "../history";
import { SaveForm } from "./save-form";
import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BookOpenIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

type Props = {
  history: HistoryItem[];
  saved: SavedQuery[];
  onLoadHistory: (entry: HistoryItem) => void;
  onLoadSaved: (query: SavedQuery) => void;
  onSaveHistory: (name: string, entry: HistoryItem) => void;
  onRemoveHistory: (id: string) => void;
  onRemoveSaved: (id: string) => void;
  onClearHistory: () => void;
  onNewQuery: () => void;
  onOpenDictionary: () => void;
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
  const {
    history,
    saved,
    onLoadHistory,
    onLoadSaved,
    onSaveHistory,
    onRemoveHistory,
    onRemoveSaved,
    onClearHistory,
    onNewQuery,
    onOpenDictionary,
  } = props;

  // Entrada do histórico cujo nome de consulta está sendo digitado (aberto pelo menu de contexto).
  const [naming, setNaming] = useState<string | null>(null);

  // Só as entradas visíveis entram no DOM; a altura de cada uma é medida (o formulário inline a aumenta).
  const historyRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: history.length,
    getScrollElement: () => historyRef.current,
    estimateSize: () => 44,
    getItemKey: (index) => history[index].id,
    overscan: 8,
  });

  return (
    <aside className="flex flex-col gap-6 border-border p-4 lg:min-h-0 lg:overflow-y-auto lg:border-r">
      <div className="flex flex-col gap-2">
        <Button variant="outline" size="sm" type="button" className="w-full" onClick={onNewQuery}>
          <PlusIcon data-icon="inline-start" />
          Nova consulta
        </Button>
        <Button variant="outline" size="sm" type="button" className="w-full" onClick={onOpenDictionary}>
          <BookOpenIcon data-icon="inline-start" />
          Dicionário
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="label">Consultas salvas</h2>
        {saved.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma ainda.</p>}
        <ul className="flex flex-col gap-1">
          {saved.map((query) => (
            <li key={query.id} className="group flex items-center gap-1">
              <ItemButton label={query.name} title={query.sql} onClick={() => onLoadSaved(query)} />
              <Button
                variant="ghost"
                size="xs"
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

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="label">
            Histórico ({history.length}/{MAX_HISTORY})
          </h2>
          <Button variant="ghost" size="xs" type="button" disabled={history.length === 0} onClick={onClearHistory}>
            Limpar
          </Button>
        </div>
        {history.length === 0 && <p className="text-xs text-muted-foreground">Vazio.</p>}
        <div
          ref={historyRef}
          className="min-h-64 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <ul className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const entry = history[item.index];
              return (
                <li
                  key={item.key}
                  data-index={item.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full pb-1"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <ContextMenu>
                    <ContextMenuTrigger className="block rounded hover:bg-accent">
                      <button
                        type="button"
                        className="w-full px-2 py-1 text-left"
                        title={entry.sql}
                        onClick={() => onLoadHistory(entry)}
                      >
                        <div className="flex items-center gap-2 font-mono text-xs">
                          {entry.error === null ? (
                            <span className="text-emerald-400">{entry.rowCount} linha(s)</span>
                          ) : (
                            <span className="text-destructive">erro</span>
                          )}
                          <span className="ml-auto text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString("pt-BR")}
                          </span>
                        </div>
                        <div className="truncate font-mono text-xs text-foreground">{oneLine(entry.sql)}</div>
                      </button>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => onLoadHistory(entry)}>Abrir</ContextMenuItem>
                      <ContextMenuItem onClick={() => setNaming(entry.id)}>Salvar como consulta…</ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem variant="destructive" onClick={() => onRemoveHistory(entry.id)}>
                        Excluir
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  {naming === entry.id && (
                    <div className="px-2 pb-1">
                      <SaveForm
                        label="salvar como consulta"
                        defaultOpen
                        onSave={(name) => onSaveHistory(name, entry)}
                        onDone={() => setNaming(null)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </aside>
  );
}
