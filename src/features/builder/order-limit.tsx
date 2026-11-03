"use client";

import { DEFAULT_LIMIT, type Limit, type OrderItem, type QueryState } from "@/lib/sql/query-state";
import { ExprInput } from "./expr-input";
import { EditableList } from "./editable-list";
import { Input } from "@/components/ui/input";
import { OptionMenu } from "@/components/option-menu";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

const DIRS: OrderItem["dir"][] = ["ASC", "DESC"];
const NULLS: { value: NonNullable<OrderItem["nulls"]> | ""; label: string }[] = [
  { value: "", label: "nulos: padrão" },
  { value: "FIRST", label: "NULLS FIRST" },
  { value: "LAST", label: "NULLS LAST" },
];
const LIMIT_STYLES: { value: Limit["style"]; label: string }[] = [
  { value: "fetch", label: "FETCH NEXT (Oracle 12c+)" },
  { value: "rownum", label: "ROWNUM (Oracle 11g)" },
];

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
          <OptionMenu label="Direção" value={item.dir} options={DIRS} onChange={(dir) => update({ dir })} />
          <OptionMenu
            label="Posição dos nulos"
            value={item.nulls ?? ""}
            options={NULLS}
            onChange={(nulls) => update({ nulls: nulls || undefined })}
          />
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
    <div className="flex flex-wrap items-center gap-3 text-xs text-foreground">
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
      <OptionMenu
        label="Estilo do limite"
        value={limit.style}
        options={LIMIT_STYLES}
        onChange={(style) => setLimit({ style })}
      />
    </div>
  );
}
