"use client";

import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useId, type ReactNode } from "react";

import {
  COND_OPS,
  VALUE_KINDS,
  emptyCond,
  emptyGroup,
  isCondGroup,
  type Cond,
  type CondGroup,
  type CondOp,
  type ValueKind,
} from "@/lib/sql/query-state";
import { ExprInput } from "./expr-input";
import { idOf, inherit, move, removeAt, replaceAt } from "./list";
import { SortableRow } from "./sortable-list";
import { RowActions } from "./row-actions";

const MAX_DEPTH = 3;
const KIND_LABELS: Record<ValueKind, string> = { text: "texto", number: "número", date: "data", expr: "expressão" };
const LIST_OPS: CondOp[] = ["IN", "NOT IN"];
const NO_VALUE_OPS: CondOp[] = ["IS NULL", "IS NOT NULL"];
const DROP_PREFIX = "drop:";

type Item = CondGroup["items"][number];

// Id do grupo: o do próprio objeto, exceto na raiz, cujo objeto é recriado a cada edição.
const groupId = (group: CondGroup, rootId: string, root: CondGroup) => (group === root ? rootId : idOf(group));

function findGroup(group: CondGroup, id: string, rootId: string, root: CondGroup = group): CondGroup | null {
  if (groupId(group, rootId, root) === id) return group;
  for (const item of group.items) {
    if (isCondGroup(item)) {
      const found = findGroup(item, id, rootId, root);
      if (found) return found;
    }
  }
  return null;
}

// Níveis de grupos abaixo de `group` (0 = sem subgrupos).
const height = (group: CondGroup): number =>
  group.items.reduce((max, item) => (isCondGroup(item) ? Math.max(max, 1 + height(item)) : max), 0);

function depthOf(group: CondGroup, id: string, rootId: string, root: CondGroup = group, depth = 0): number {
  if (groupId(group, rootId, root) === id) return depth;
  for (const item of group.items) {
    if (isCondGroup(item)) {
      const found = depthOf(item, id, rootId, root, depth + 1);
      if (found >= 0) return found;
    }
  }
  return -1;
}

// Refaz a árvore trocando os itens do grupo `id`, preservando os ids dos grupos recriados.
function editItems(root: CondGroup, rootId: string, id: string, edit: (items: Item[]) => Item[]): CondGroup {
  const walk = (group: CondGroup): CondGroup => {
    const items = groupId(group, rootId, root) === id ? edit(group.items) : group.items;
    const next = { ...group, items: items.map((item) => (isCondGroup(item) ? walk(item) : item)) };
    return group === root ? next : inherit(group, next);
  };
  return walk(root);
}

// Move um item entre grupos (ou dentro do mesmo). Recusa soltar um grupo dentro de si mesmo e passar de MAX_DEPTH.
function moveItem(root: CondGroup, rootId: string, from: [string, number], to: [string, number]): CondGroup {
  const item = findGroup(root, from[0], rootId)?.items[from[1]];
  if (!item) return root;
  if (isCondGroup(item)) {
    if (findGroup(item, to[0], rootId, item)) return root;
    if (depthOf(root, to[0], rootId) + 1 + height(item) > MAX_DEPTH) return root;
  }
  const removed = editItems(root, rootId, from[0], (items) => items.filter((_, i) => i !== from[1]));
  return editItems(removed, rootId, to[0], (items) => {
    const next = [...items];
    next.splice(to[1], 0, item);
    return next;
  });
}

// Área de soltura do grupo, para receber itens quando ele está vazio (baixa prioridade: as linhas vencem).
function GroupDrop({ id, children }: { id: string; children: ReactNode }) {
  const { ref } = useDroppable({ id: DROP_PREFIX + id, type: "group", accept: "item", collisionPriority: 1 });
  return (
    <div ref={ref} className="flex min-h-6 flex-col gap-2">
      {children}
    </div>
  );
}

function valuePlaceholder(cond: Cond): string {
  if (LIST_OPS.includes(cond.op)) return cond.right.kind === "date" ? "2026-01-01, 2026-02-01" : "a, b, c";
  if (cond.right.kind === "expr") return "PAR.CODPARC";
  return "valor";
}

function CondRow({ cond, onChange }: { cond: Cond; onChange: (cond: Cond) => void }) {
  const { right } = cond;
  const setRight = (patch: Partial<Cond["right"]>) => onChange({ ...cond, right: { ...right, ...patch } });
  // Seletor de data nativo só para um valor único; listas de datas são digitadas.
  const inputType = right.kind === "date" && !LIST_OPS.includes(cond.op) ? "date" : "text";

  return (
    <div className={`flex min-w-0 flex-1 flex-wrap gap-1.5 ${cond.off ? "opacity-50" : ""}`}>
      <ExprInput
        label="Lado esquerdo"
        className="min-w-40 flex-1"
        placeholder="CAB.CODEMP"
        value={cond.left}
        onChange={(left) => onChange({ ...cond, left })}
      />
      <select
        aria-label="Operador"
        className="input"
        value={cond.op}
        onChange={(event) => onChange({ ...cond, op: event.target.value as CondOp })}
      >
        {COND_OPS.map((op) => (
          <option key={op}>{op}</option>
        ))}
      </select>
      {!NO_VALUE_OPS.includes(cond.op) && (
        <>
          <select
            aria-label="Tipo do valor"
            className="input"
            value={right.kind}
            onChange={(event) => setRight({ kind: event.target.value as ValueKind })}
          >
            {VALUE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <input
            aria-label="Valor"
            type={inputType}
            spellCheck={false}
            className="input min-w-24 flex-1 font-mono"
            placeholder={valuePlaceholder(cond)}
            value={right.value}
            onChange={(event) => setRight({ value: event.target.value })}
          />
          {cond.op === "BETWEEN" && (
            <input
              aria-label="Segundo valor"
              type={inputType}
              spellCheck={false}
              className="input min-w-24 flex-1 font-mono"
              placeholder="até"
              value={right.value2 ?? ""}
              onChange={(event) => setRight({ value2: event.target.value })}
            />
          )}
        </>
      )}
    </div>
  );
}

type Props = {
  group: CondGroup;
  onChange: (group: CondGroup) => void;
  depth?: number;
  onRemove?: () => void;
  onToggleOff?: () => void;
};

// Grupo AND/OR com condições e subgrupos aninhados (até MAX_DEPTH níveis). A raiz cria o provider de arraste:
// condições e subgrupos podem ser levados para dentro e para fora de qualquer grupo dela.
export function CondGroupEditor(props: Props) {
  const rootId = useId();
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const { source } = event.operation;
        if (!isSortable(source) || source.initialGroup == null || source.group == null) return;
        const from = String(source.initialGroup).replace(DROP_PREFIX, "");
        const to = String(source.group).replace(DROP_PREFIX, "");
        if (from === to && source.initialIndex === source.index) return;
        props.onChange(moveItem(props.group, rootId, [from, source.initialIndex], [to, source.index]));
      }}
    >
      <GroupBody {...props} rootId={rootId} root={props.group} />
    </DragDropProvider>
  );
}

type BodyProps = Props & { rootId: string; root: CondGroup };

function GroupBody({ group, onChange, depth = 0, onRemove, onToggleOff, rootId, root }: BodyProps) {
  const setItems = (items: CondGroup["items"]) => onChange({ ...group, items });
  const id = groupId(group, rootId, root);

  return (
    <div
      className={`flex flex-col gap-2 ${depth > 0 ? "rounded border border-dashed border-zinc-700 p-2" : ""} ${group.off ? "opacity-50" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded border border-zinc-700 text-xs">
          {(["AND", "OR"] as const).map((op) => (
            <button
              key={op}
              type="button"
              className={`px-2 py-0.5 ${group.op === op ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:bg-zinc-800"}`}
              onClick={() => onChange({ ...group, op })}
            >
              {op}
            </button>
          ))}
        </div>
        <button type="button" className="btn-ghost" onClick={() => setItems([...group.items, emptyCond()])}>
          + condição
        </button>
        {depth < MAX_DEPTH && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setItems([...group.items, emptyGroup(group.op === "AND" ? "OR" : "AND")])}
          >
            + grupo
          </button>
        )}
        {onToggleOff && (
          <button type="button" className={`btn-ghost ml-auto ${group.off ? "text-amber-300" : ""}`} onClick={onToggleOff}>
            {group.off ? "incluir grupo" : "omitir grupo"}
          </button>
        )}
        {onRemove && (
          <button type="button" className={`btn-ghost ${onToggleOff ? "" : "ml-auto"}`} onClick={onRemove}>
            remover grupo
          </button>
        )}
      </div>

      <GroupDrop id={id}>
        {group.items.map((item, index) => {
          const itemId = idOf(item);
          return (
            <SortableRow key={itemId} id={itemId} item={item} index={index} group={id}>
              {(item, index, grip) => (
                <div className="flex items-start gap-1">
                  <span className="mt-1.5 flex">{grip}</span>
                  {isCondGroup(item) ? (
                    <div className="min-w-0 flex-1">
                      <GroupBody
                        group={item}
                        depth={depth + 1}
                        rootId={rootId}
                        root={root}
                        onChange={(next) => setItems(replaceAt(group.items, index, next))}
                        onRemove={() => setItems(removeAt(group.items, index))}
                        onToggleOff={() => setItems(replaceAt(group.items, index, { ...item, off: !item.off }))}
                      />
                    </div>
                  ) : (
                    <>
                      <CondRow cond={item} onChange={(next) => setItems(replaceAt(group.items, index, next))} />
                      <RowActions
                        index={index}
                        count={group.items.length}
                        onMove={(to) => setItems(move(group.items, index, to))}
                        onRemove={() => setItems(removeAt(group.items, index))}
                        off={item.off}
                        onToggleOff={() => setItems(replaceAt(group.items, index, { ...item, off: !item.off }))}
                      />
                    </>
                  )}
                </div>
              )}
            </SortableRow>
          );
        })}
      </GroupDrop>
    </div>
  );
}
