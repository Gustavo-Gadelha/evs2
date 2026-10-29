"use client";

import { DEFAULT_LIMIT, type Limit, type OrderItem, type QueryState } from "@/lib/sql/query-state";
import { ExprInput } from "./expr-input";
import { move, removeAt, replaceAt } from "./list";
import { RowActions } from "./row-actions";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

export function OrderByClause({ state, onChange }: Props) {
  const items = state.orderBy;
  const setItems = (orderBy: OrderItem[]) => onChange({ orderBy });
  const update = (index: number, patch: Partial<OrderItem>) =>
    setItems(replaceAt(items, index, { ...items[index], ...patch }));

  return (
    <>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <ExprInput
            label="Expressão do ORDER BY"
            className="min-w-0 flex-1"
            placeholder="CAB.DTNEG"
            value={item.expr}
            onChange={(expr) => update(index, { expr })}
          />
          <select
            aria-label="Direção"
            className="input"
            value={item.dir}
            onChange={(event) => update(index, { dir: event.target.value as OrderItem["dir"] })}
          >
            <option>ASC</option>
            <option>DESC</option>
          </select>
          <select
            aria-label="Posição dos nulos"
            className="input"
            value={item.nulls ?? ""}
            onChange={(event) => update(index, { nulls: (event.target.value || undefined) as OrderItem["nulls"] })}
          >
            <option value="">nulos: padrão</option>
            <option value="FIRST">NULLS FIRST</option>
            <option value="LAST">NULLS LAST</option>
          </select>
          <RowActions
            index={index}
            count={items.length}
            onMove={(to) => setItems(move(items, index, to))}
            onRemove={() => setItems(removeAt(items, index))}
          />
        </div>
      ))}
      <button type="button" className="btn-ghost self-start" onClick={() => setItems([...items, { expr: "", dir: "ASC" }])}>
        + ordenação
      </button>
    </>
  );
}

export function LimitClause({ state, onChange }: Props) {
  const { limit } = state;
  const setLimit = (patch: Partial<Limit>) => onChange({ limit: { ...(limit ?? DEFAULT_LIMIT), ...patch } });

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={limit !== null}
          onChange={(event) => onChange({ limit: event.target.checked ? { ...DEFAULT_LIMIT } : null })}
        />
        limitar
      </label>
      {limit && (
        <>
          <label className="flex items-center gap-1.5">
            linhas
            <input
              type="number"
              min={1}
              className="input w-24"
              value={Number.isFinite(limit.rows) ? limit.rows : ""}
              onChange={(event) => setLimit({ rows: event.target.valueAsNumber })}
            />
          </label>
          <label className="flex items-center gap-1.5">
            offset
            <input
              type="number"
              min={0}
              className="input w-24"
              value={Number.isFinite(limit.offset) ? limit.offset : ""}
              onChange={(event) => setLimit({ offset: event.target.valueAsNumber })}
            />
          </label>
          <select
            aria-label="Estilo do limite"
            className="input"
            value={limit.style}
            onChange={(event) => setLimit({ style: event.target.value as Limit["style"] })}
          >
            <option value="fetch">FETCH NEXT (Oracle 12c+)</option>
            <option value="rownum">ROWNUM (Oracle 11g)</option>
          </select>
        </>
      )}
    </div>
  );
}
