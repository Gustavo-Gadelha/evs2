"use client";

import type { QueryState } from "@/lib/sql/query-state";
import { groupByExprs } from "@/lib/sql/to-oracle";
import { CondGroupEditor } from "./cond-group";
import { ExprInput } from "./expr-input";
import { move, removeAt, replaceAt } from "./list";
import { RowActions } from "./row-actions";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

export function GroupByClause({ state, onChange }: Props) {
  const { mode, exprs } = state.groupBy;
  const setGroupBy = (patch: Partial<QueryState["groupBy"]>) => onChange({ groupBy: { ...state.groupBy, ...patch } });
  const auto = groupByExprs({ ...state, groupBy: { mode: "auto", exprs: [] } });

  return (
    <>
      <div className="flex gap-3 text-xs">
        {(["auto", "manual"] as const).map((option) => (
          <label key={option} className="flex items-center gap-1.5 text-zinc-300">
            <input
              type="radio"
              name="group-by-mode"
              checked={mode === option}
              // Ao passar para manual, começa pelo que o automático geraria.
              onChange={() => setGroupBy(option === "manual" && exprs.length === 0 ? { mode: option, exprs: auto } : { mode: option })}
            />
            {option === "auto" ? "automático" : "manual"}
          </label>
        ))}
      </div>
      {mode === "auto" ? (
        <p className="font-mono text-xs text-zinc-400">
          {auto.length ? auto.join(", ") : "Sem agregação no SELECT: sem GROUP BY."}
        </p>
      ) : (
        <>
          {exprs.map((expr, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <ExprInput
                label="Expressão do GROUP BY"
                className="min-w-0 flex-1"
                value={expr}
                onChange={(value) => setGroupBy({ exprs: replaceAt(exprs, index, value) })}
              />
              <RowActions
                index={index}
                count={exprs.length}
                onMove={(to) => setGroupBy({ exprs: move(exprs, index, to) })}
                onRemove={() => setGroupBy({ exprs: removeAt(exprs, index) })}
              />
            </div>
          ))}
          <button type="button" className="btn-ghost self-start" onClick={() => setGroupBy({ exprs: [...exprs, ""] })}>
            + expressão
          </button>
        </>
      )}
    </>
  );
}

export function HavingClause({ state, onChange }: Props) {
  return <CondGroupEditor group={state.having} onChange={(having) => onChange({ having })} />;
}
