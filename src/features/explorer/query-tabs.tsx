"use client";

import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";

import { tabTitle, type Tab } from "./tabs";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const idOf = (tab: Tab) => tab.id;

type Props = {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  // `focusId`: aba que passa a ficar ativa se a ativa for fechada.
  onClose: (ids: string[], focusId?: string) => void;
  onAdd: () => void;
};

// Barra de abas das consultas abertas; o botão de fechar de cada aba fica fora do botão que a seleciona.
// O menu de contexto (botão direito) fecha a aba, as outras, as da direita, as da esquerda ou todas.
export function QueryTabs({ tabs, activeId, onSelect, onClose, onAdd }: Props) {
  return (
    <div role="tablist" aria-label="Consultas abertas" className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 py-1">
      {tabs.map((tab, index) => {
        const active = tab.id === activeId;
        const title = tabTitle(tab);
        const others = tabs.filter((other) => other !== tab).map(idOf);
        return (
          <ContextMenu key={tab.id}>
          <ContextMenuTrigger
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
              onClick={() => onClose([tab.id])}
            >
              <XIcon className="size-3" />
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onClose([tab.id])}>Fechar</ContextMenuItem>
            <ContextMenuItem disabled={tabs.length === 1} onClick={() => onClose(others, tab.id)}>
              Fechar outras
            </ContextMenuItem>
            <ContextMenuItem disabled={index === tabs.length - 1} onClick={() => onClose(tabs.slice(index + 1).map(idOf), tab.id)}>
              Fechar à direita
            </ContextMenuItem>
            <ContextMenuItem disabled={index === 0} onClick={() => onClose(tabs.slice(0, index).map(idOf), tab.id)}>
              Fechar à esquerda
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => onClose(tabs.map(idOf))}>
              Fechar todas
            </ContextMenuItem>
          </ContextMenuContent>
          </ContextMenu>
        );
      })}
      <Button variant="ghost" size="xs" type="button" aria-label="Nova aba" title="Nova aba" onClick={onAdd}>
        <PlusIcon />
      </Button>
    </div>
  );
}
