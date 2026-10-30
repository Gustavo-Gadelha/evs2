"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { GripVertical } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { idOf } from "./list";

type Props<T> = {
  items: T[];
  // Id estável da linha; o padrão é `idOf`, que só serve para itens que são objetos (texto precisa passar o seu).
  getId?: (item: T, index: number) => string;
  onMove: (from: number, to: number) => void;
  // `grip` é o indicador de arraste: cada editor o coloca à esquerda da linha.
  children: (item: T, index: number, grip: ReactNode) => ReactNode;
};

type RowProps<T> = {
  id: string;
  item: T;
  index: number;
  // Com `group`, a linha pode ser solta em outras listas do mesmo provider que usem o mesmo `group`/tipo.
  group?: string;
  children: Props<T>["children"];
};

export function SortableRow<T>({ id, item, index, group, children }: RowProps<T>) {
  const handle = useRef<HTMLButtonElement>(null);
  const { ref, isDragging } = useSortable({ id, index, handle, group, type: "item", accept: "item" });

  const grip = (
    <button
      ref={handle}
      type="button"
      className="shrink-0 cursor-grab touch-none rounded p-0.5 text-zinc-500 hover:text-zinc-200 active:cursor-grabbing"
      aria-label="Arrastar para reordenar"
      title="Arrastar para reordenar"
    >
      <GripVertical size={16} />
    </button>
  );

  return (
    <div ref={ref} className={isDragging ? "opacity-60" : undefined}>
      {children(item, index, grip)}
    </div>
  );
}

// Lista reordenável por arraste (e pelo teclado, no grip). Cada lista tem o próprio provider, então listas
// aninhadas (grupos de condições) só reordenam os próprios itens.
export function SortableList<T>({ items, getId = (item) => idOf(item as object), onMove, children }: Props<T>) {
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const { source } = event.operation;
        if (isSortable(source) && source.initialIndex !== source.index) onMove(source.initialIndex, source.index);
      }}
    >
      {items.map((item, index) => {
        const id = getId(item, index);
        return (
          <SortableRow key={id} id={id} item={item} index={index}>
            {children}
          </SortableRow>
        );
      })}
    </DragDropProvider>
  );
}
