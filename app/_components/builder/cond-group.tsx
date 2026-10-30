"use client";

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
import { move, removeAt, replaceAt } from "./list";
import { SortableList } from "./sortable-list";
import { RowActions } from "./row-actions";

const MAX_DEPTH = 3;
const KIND_LABELS: Record<ValueKind, string> = { text: "texto", number: "número", date: "data", expr: "expressão" };
const LIST_OPS: CondOp[] = ["IN", "NOT IN"];
const NO_VALUE_OPS: CondOp[] = ["IS NULL", "IS NOT NULL"];

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

// Grupo AND/OR com condições e subgrupos aninhados (até MAX_DEPTH níveis).
export function CondGroupEditor({ group, onChange, depth = 0, onRemove, onToggleOff }: Props) {
  const setItems = (items: CondGroup["items"]) => onChange({ ...group, items });

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

      <SortableList items={group.items} onMove={(from, to) => setItems(move(group.items, from, to))}>
        {(item, index, grip) => (
          <div className="flex items-start gap-1">
            <span className="mt-1.5 flex">{grip}</span>
            {isCondGroup(item) ? (
              <div className="min-w-0 flex-1">
                <CondGroupEditor
                  group={item}
                  depth={depth + 1}
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
      </SortableList>
    </div>
  );
}
