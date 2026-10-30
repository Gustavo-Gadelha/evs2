"use client";

import { JOIN_TYPES, type Join, type JoinType, type QueryState } from "@/lib/sql/query-state";
import { CondGroupEditor } from "./cond-group";
import { Combobox } from "@/components/combobox";
import { useDictionary } from "@/features/dictionary/components/dictionary-provider";
import { EditableList } from "./editable-list";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

// Tabelas e aliases Oracle sem aspas: sempre em maiúsculas.
function IdentInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className: string;
  suggest?: boolean;
}) {
  const { tables } = useDictionary();
  return (
    <Combobox
      label={props.label}
      className={props.className}
      inputClassName="font-mono uppercase"
      placeholder={props.placeholder}
      value={props.value}
      onChange={(value) => props.onChange(value.toUpperCase())}
      getItems={props.suggest ? tables : () => []}
    />
  );
}

export function FromClause({ state, onChange }: Props) {
  return (
    <div className="flex gap-1.5">
      <IdentInput
        label="Tabela"
        suggest
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
  return (
    <EditableList
      items={state.joins}
      onChange={(joins) => onChange({ joins })}
      omittable
      rowClassName="rounded border border-zinc-800 p-2"
      add={[{ label: "+ join", make: newJoin }]}
      renderRow={(join, _, update) => (
        <>
          <select
            aria-label="Tipo de join"
            className="input"
            value={join.type}
            onChange={(event) => update({ type: event.target.value as JoinType })}
          >
            {JOIN_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
          <IdentInput
            label="Tabela do join"
            suggest
            className="min-w-0 flex-1"
            placeholder="TGFPAR"
            value={join.table}
            onChange={(table) => update({ table })}
          />
          <IdentInput
            label="Alias do join"
            className="w-24"
            placeholder="PAR"
            value={join.alias}
            onChange={(alias) => update({ alias })}
          />
        </>
      )}
      renderBelow={(join, _, update) => (
        <div className="flex items-start gap-2 pl-2">
          <span className="pt-1 font-mono text-xs text-zinc-500">ON</span>
          <div className="min-w-0 flex-1">
            <CondGroupEditor group={join.on} onChange={(on) => update({ on })} />
          </div>
        </div>
      )}
    />
  );
}
