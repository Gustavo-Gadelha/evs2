"use client";

import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";

import { tabTitle, type Tab } from "./tabs";
import { Button } from "@/components/ui/button";

type Props = {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
};

// Barra de abas das consultas abertas; o botão de fechar de cada aba fica fora do botão que a seleciona.
export function QueryTabs({ tabs, activeId, onSelect, onClose, onAdd }: Props) {
  return (
    <div role="tablist" aria-label="Consultas abertas" className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 py-1">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const title = tabTitle(tab);
        return (
          <div
            key={tab.id}
            className={`flex shrink-0 items-center rounded-md ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={active}
              title={title}
              className="flex max-w-48 items-center gap-1.5 truncate py-1 pr-1 pl-2.5 text-xs"
              onClick={() => onSelect(tab.id)}
            >
              {tab.running && <Loader2Icon className="size-3 shrink-0 animate-spin" />}
              <span className="truncate">{title}</span>
              {tab.manual && <span className="shrink-0 text-amber-300" title="editado à mão">•</span>}
            </button>
            <button
              type="button"
              aria-label={`Fechar ${title}`}
              className="mr-1 rounded p-0.5 hover:bg-background/60"
              onClick={() => onClose(tab.id)}
            >
              <XIcon className="size-3" />
            </button>
          </div>
        );
      })}
      <Button variant="ghost" size="xs" type="button" aria-label="Nova aba" title="Nova aba" onClick={onAdd}>
        <PlusIcon />
      </Button>
    </div>
  );
}
