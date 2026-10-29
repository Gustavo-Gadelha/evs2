"use client";

import { JOIN_TYPES, type Join, type JoinType, type QueryState } from "@/lib/sql/query-state";
import { CondGroupEditor } from "./cond-group";
import { move, removeAt, replaceAt } from "./list";
import { RowActions } from "./row-actions";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

// Tabelas e aliases Oracle sem aspas: sempre em maiúsculas.
function IdentInput(props: { label: string; value: string; onChange: (value: string) => void; placeholder: string; className: string }) {
  return (
    <input
      aria-label={props.label}
      spellCheck={false}
      className={`input font-mono uppercase ${props.className}`}
      placeholder={props.placeholder}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value.toUpperCase())}
    />
  );
}

export function FromClause({ state, onChange }: Props) {
  return (
    <div className="flex gap-1.5">
      <IdentInput
        label="Tabela"
        className="min-w-0 flex-1"
        placeholder="TGFCAB"
        value={state.from.table}
        onChange={(table) => onChange({ from: { ...state.from, table } })}
      />
      <IdentInput
        label="Alias"
        className="w-24"
        placeholder="CAB"
        value={state.from.alias}
        onChange={(alias) => onChange({ from: { ...state.from, alias } })}
      />
    </div>
  );
}

function newJoin(): Join {
  return { type: "LEFT", table: "", alias: "", on: { op: "AND", items: [{ left: "", op: "=", right: { kind: "expr", value: "" } }] } };
}

export function JoinsClause({ state, onChange }: Props) {
  const { joins } = state;
  const setJoins = (next: Join[]) => onChange({ joins: next });
  const update = (index: number, patch: Partial<Join>) => setJoins(replaceAt(joins, index, { ...joins[index], ...patch }));

  return (
    <>
      {joins.map((join, index) => (
        <div key={index} className="flex flex-col gap-2 rounded border border-zinc-800 p-2">
          <div className="flex gap-1.5">
            <select
              aria-label="Tipo de join"
              className="input"
              value={join.type}
              onChange={(event) => update(index, { type: event.target.value as JoinType })}
            >
              {JOIN_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <IdentInput
              label="Tabela do join"
              className="min-w-0 flex-1"
              placeholder="TGFPAR"
              value={join.table}
              onChange={(table) => update(index, { table })}
            />
            <IdentInput
              label="Alias do join"
              className="w-24"
              placeholder="PAR"
              value={join.alias}
              onChange={(alias) => update(index, { alias })}
            />
            <RowActions
              index={index}
              count={joins.length}
              onMove={(to) => setJoins(move(joins, index, to))}
              onRemove={() => setJoins(removeAt(joins, index))}
            />
          </div>
          <div className="flex items-start gap-2 pl-2">
            <span className="pt-1 font-mono text-xs text-zinc-500">ON</span>
            <div className="min-w-0 flex-1">
              <CondGroupEditor group={join.on} onChange={(on) => update(index, { on })} />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn-ghost self-start" onClick={() => setJoins([...joins, newJoin()])}>
        + join
      </button>
    </>
  );
}
