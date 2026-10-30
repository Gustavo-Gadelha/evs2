"use client";

import type { ReactNode } from "react";

import { move, removeAt, replaceAt } from "./list";
import { RowActions } from "./row-actions";
import { SortableList } from "./sortable-list";

type Props<T extends { off?: boolean }> = {
  items: T[];
  onChange: (items: T[]) => void;
  // Campos da linha, entre o grip e os botões; `update` aplica um patch parcial no item.
  renderRow: (item: T, index: number, update: (patch: Partial<T>) => void) => ReactNode;
  // Conteúdo abaixo dos campos (ex.: o ON de um join).
  renderBelow?: (item: T, index: number, update: (patch: Partial<T>) => void) => ReactNode;
  // Botões de adicionar: cada um cria o item novo que entra no fim da lista.
  add: { label: string; make: () => T }[];
  // Mostra o botão de omitir do SQL (o item precisa ter `off`).
  omittable?: boolean;
  rowClassName?: string;
};

// Lista editável do builder: arraste com grip, mover/omitir/remover por linha e botões de adicionar.
// Só serve para itens objeto (o id estável vem de `idOf`).
export function EditableList<T extends { off?: boolean }>({
  items,
  onChange,
  renderRow,
  renderBelow,
  add,
  omittable = false,
  rowClassName = "",
}: Props<T>) {
  return (
    <>
      <SortableList items={items} onMove={(from, to) => onChange(move(items, from, to))}>
        {(item, index, grip) => {
          const off = omittable && item.off;
          const update = (patch: Partial<T>) => onChange(replaceAt(items, index, { ...items[index], ...patch }));
          return (
            <div className={`flex flex-col gap-2 ${rowClassName} ${off ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-1.5">
                {grip}
                {renderRow(item, index, update)}
                <RowActions
                  index={index}
                  count={items.length}
                  onMove={(to) => onChange(move(items, index, to))}
                  onRemove={() => onChange(removeAt(items, index))}
                  off={off || false}
                  onToggleOff={omittable ? () => update({ off: !item.off } as Partial<T>) : undefined}
                />
              </div>
              {renderBelow?.(item, index, update)}
            </div>
          );
        }}
      </SortableList>
      <div className="flex gap-2">
        {add.map(({ label, make }) => (
          <button key={label} type="button" className="btn-ghost" onClick={() => onChange([...items, make()])}>
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
