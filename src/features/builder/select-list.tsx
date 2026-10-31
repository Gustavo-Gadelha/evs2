"use client";

import { AGG_FNS, type AggExpr, type AggFn, type Expr, type QueryState, type SelectItem } from "@/lib/sql/query-state";
import { ExprInput } from "./expr-input";
import { EditableList } from "./editable-list";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Props = { state: QueryState; onChange: (patch: Partial<QueryState>) => void };

function AggEditor({ expr, onChange }: { expr: AggExpr; onChange: (expr: Expr) => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <NativeSelect
        size="sm"
        aria-label="Agregação"
        className="font-semibold"
        value={expr.fn}
        onChange={(event) => onChange({ ...expr, fn: event.target.value as AggFn })}
      >
        {AGG_FNS.map((fn) => (
          <option key={fn}>{fn}</option>
        ))}
      </NativeSelect>
      <Label className="gap-1 text-xs font-normal text-muted-foreground">
        <Checkbox checked={expr.distinct} onCheckedChange={(checked) => onChange({ ...expr, distinct: checked })} />
        DISTINCT
      </Label>
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

  return (
    <>
      <Label className="text-xs font-normal">
        <Checkbox checked={state.distinct} onCheckedChange={(checked) => onChange({ distinct: checked })} />
        DISTINCT
      </Label>
      {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma coluna: SELECT *.</p>}
      <EditableList
        items={items}
        onChange={(select) => onChange({ select })}
        omittable
        add={[
          { label: "+ coluna", make: (): SelectItem => ({ expr: { kind: "raw", sql: "" } }) },
          { label: "+ agregação", make: (): SelectItem => ({ expr: { kind: "agg", fn: "COUNT", arg: "", distinct: false } }) },
        ]}
        renderRow={(item, _, update) => (
          <>
            {item.expr.kind === "raw" ? (
              <ExprInput
                label="Coluna"
                className="min-w-0 flex-1"
                placeholder="CAB.NUNOTA"
                value={item.expr.sql}
                onChange={(sql) => update({ expr: { kind: "raw", sql } })}
              />
            ) : (
              <AggEditor expr={item.expr} onChange={(expr) => update({ expr })} />
            )}
            <Input
              aria-label="Alias da coluna"
              spellCheck={false}
              className="w-28 font-mono"
              placeholder="alias"
              value={item.alias ?? ""}
              onChange={(event) => update({ alias: event.target.value })}
            />
          </>
        )}
      />
    </>
  );
}
