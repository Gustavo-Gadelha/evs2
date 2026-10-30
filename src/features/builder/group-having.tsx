"use client";

import { useRef } from "react";

import type { QueryState } from "@/lib/sql/query-state";
import { groupByExprs } from "@/lib/sql/to-oracle";
import { CondGroupEditor } from "./cond-group";
import { ExprInput } from "./expr-input";
import { move, removeAt, replaceAt } from "./list";
import { RowActions } from "./row-actions";
import { SortableList } from "./sortable-list";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

export function GroupByClause({ state, onChange }: Props) {
  const { mode, exprs } = state.groupBy;
  const setGroupBy = (patch: Partial<QueryState["groupBy"]>) => onChange({ groupBy: { ...state.groupBy, ...patch } });
  // Expressões são texto, sem identidade própria: os ids ficam num vetor paralelo, mantido junto com cada edição.
  const ids = useRef<string[]>([]);
  if (ids.current.length !== exprs.length) ids.current = exprs.map(() => crypto.randomUUID());
  const setExprs = (next: string[], nextIds: string[] = ids.current) => {
    ids.current = nextIds;
    setGroupBy({ exprs: next });
  };
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
          <SortableList
            items={exprs}
            getId={(_, index) => ids.current[index]}
            onMove={(from, to) => setExprs(move(exprs, from, to), move(ids.current, from, to))}
          >
            {(expr, index, grip) => (
              <div className="flex items-center gap-1.5">
                {grip}
                <ExprInput
                  label="Expressão do GROUP BY"
                  className="min-w-0 flex-1"
                  value={expr}
                  onChange={(value) => setExprs(replaceAt(exprs, index, value))}
                />
                <RowActions
                  index={index}
                  count={exprs.length}
                  onMove={(to) => setExprs(move(exprs, index, to), move(ids.current, index, to))}
                  onRemove={() => setExprs(removeAt(exprs, index), removeAt(ids.current, index))}
                />
              </div>
            )}
          </SortableList>
          <button
            type="button"
            className="btn-ghost self-start"
            onClick={() => setExprs([...exprs, ""], [...ids.current, crypto.randomUUID()])}
          >
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
