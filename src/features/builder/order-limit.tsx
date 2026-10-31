"use client";

import { DEFAULT_LIMIT, type Limit, type OrderItem, type QueryState } from "@/lib/sql/query-state";
import { ExprInput } from "./expr-input";
import { EditableList } from "./editable-list";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

export function OrderByClause({ state, onChange }: Props) {
  return (
    <EditableList
      items={state.orderBy}
      onChange={(orderBy) => onChange({ orderBy })}
      omittable
      add={[{ label: "+ ordenação", make: (): OrderItem => ({ expr: "", dir: "ASC" }) }]}
      renderRow={(item, _, update) => (
        <>
          <ExprInput
            label="Expressão do ORDER BY"
            className="min-w-0 flex-1"
            placeholder="CAB.DTNEG"
            value={item.expr}
            onChange={(expr) => update({ expr })}
          />
          <NativeSelect
            size="sm"
            aria-label="Direção"
            value={item.dir}
            onChange={(event) => update({ dir: event.target.value as OrderItem["dir"] })}
          >
            <option>ASC</option>
            <option>DESC</option>
          </NativeSelect>
          <NativeSelect
            size="sm"
            aria-label="Posição dos nulos"
            value={item.nulls ?? ""}
            onChange={(event) => update({ nulls: (event.target.value || undefined) as OrderItem["nulls"] })}
          >
            <option value="">nulos: padrão</option>
            <option value="FIRST">NULLS FIRST</option>
            <option value="LAST">NULLS LAST</option>
          </NativeSelect>
        </>
      )}
    />
  );
}

export function LimitClause({ state, onChange }: Props) {
  // Desligar o limite é pelo "omitir" do bloco; consultas antigas sem limite abrem com os valores padrão.
  const limit = state.limit ?? DEFAULT_LIMIT;
  const setLimit = (patch: Partial<Limit>) => onChange({ limit: { ...limit, ...patch } });

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
      <label className="flex items-center gap-1.5">
        linhas
        <Input
          type="number"
          min={1}
          className="w-24"
          value={Number.isFinite(limit.rows) ? limit.rows : ""}
          onChange={(event) => setLimit({ rows: event.target.valueAsNumber })}
        />
      </label>
      <label className="flex items-center gap-1.5">
        offset
        <Input
          type="number"
          min={0}
          className="w-24"
          value={Number.isFinite(limit.offset) ? limit.offset : ""}
          onChange={(event) => setLimit({ offset: event.target.valueAsNumber })}
        />
      </label>
      <NativeSelect
        size="sm"
        aria-label="Estilo do limite"
        value={limit.style}
        onChange={(event) => setLimit({ style: event.target.value as Limit["style"] })}
      >
        <option value="fetch">FETCH NEXT (Oracle 12c+)</option>
        <option value="rownum">ROWNUM (Oracle 11g)</option>
      </NativeSelect>
    </div>
  );
}
