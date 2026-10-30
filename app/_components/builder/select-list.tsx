"use client";

import { AGG_FNS, type AggExpr, type AggFn, type Expr, type QueryState, type SelectItem } from "@/lib/sql/query-state";
import { ExprInput } from "./expr-input";
import { move, removeAt, replaceAt } from "./list";
import { SortableList } from "./sortable-list";
import { RowActions } from "./row-actions";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

function AggEditor({ expr, onChange }: { expr: AggExpr; onChange: (expr: Expr) => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <select
        aria-label="Agregação"
        className="input font-semibold"
        value={expr.fn}
        onChange={(event) => onChange({ ...expr, fn: event.target.value as AggFn })}
      >
        {AGG_FNS.map((fn) => (
          <option key={fn}>{fn}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={expr.distinct}
          onChange={(event) => onChange({ ...expr, distinct: event.target.checked })}
        />
        DISTINCT
      </label>
      <ExprInput
        label="Argumento"
        className="min-w-0 flex-1"
        placeholder={expr.fn === "COUNT" ? "vazio = COUNT(*)" : "ITE.VLRTOT"}
        value={expr.arg}
        onChange={(arg) => onChange({ ...expr, arg })}
      />
    </div>
  );
}

export function SelectClause({ state, onChange }: Props) {
  const items = state.select;
  const setItems = (select: SelectItem[]) => onChange({ select });
  const update = (index: number, patch: Partial<SelectItem>) =>
    setItems(replaceAt(items, index, { ...items[index], ...patch }));

  return (
    <>
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input type="checkbox" checked={state.distinct} onChange={(event) => onChange({ distinct: event.target.checked })} />
        DISTINCT
      </label>
      {items.length === 0 && <p className="text-xs text-zinc-500">Nenhuma coluna: SELECT *.</p>}
      <SortableList items={items} onMove={(from, to) => setItems(move(items, from, to))}>
        {(item, index, grip) => (
          <div className={`flex items-center gap-1.5 ${item.off ? "opacity-50" : ""}`}>
            {grip}
            {item.expr.kind === "raw" ? (
              <ExprInput
                label="Coluna"
                className="min-w-0 flex-1"
                placeholder="CAB.NUNOTA"
                value={item.expr.sql}
                onChange={(sql) => update(index, { expr: { kind: "raw", sql } })}
              />
            ) : (
              <AggEditor expr={item.expr} onChange={(expr) => update(index, { expr })} />
            )}
            <input
              aria-label="Alias da coluna"
              spellCheck={false}
              className="input w-28 font-mono"
              placeholder="alias"
              value={item.alias ?? ""}
              onChange={(event) => update(index, { alias: event.target.value })}
            />
            <RowActions
              index={index}
              count={items.length}
              onMove={(to) => setItems(move(items, index, to))}
              onRemove={() => setItems(removeAt(items, index))}
              off={item.off}
              onToggleOff={() => update(index, { off: !item.off })}
            />
          </div>
        )}
      </SortableList>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" onClick={() => setItems([...items, { expr: { kind: "raw", sql: "" } }])}>
          + coluna
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setItems([...items, { expr: { kind: "agg", fn: "COUNT", arg: "", distinct: false } }])}
        >
          + agregação
        </button>
      </div>
    </>
  );
}
