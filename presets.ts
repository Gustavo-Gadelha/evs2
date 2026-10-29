// Modelos da barra lateral. Edite à vontade: cada item carrega o builder com o QueryState abaixo.

import {
  emptyQueryState,
  type AggFn,
  type Cond,
  type CondOp,
  type QueryState,
  type SelectItem,
  type ValueKind,
} from "@/lib/sql/query-state";

export type Preset = { id: string; label: string; state: QueryState };

const col = (sql: string, alias?: string): SelectItem => ({ expr: { kind: "raw", sql }, alias });
const agg = (fn: AggFn, arg: string, alias?: string): SelectItem => ({
  expr: { kind: "agg", fn, arg, distinct: false },
  alias,
});
const cond = (left: string, op: CondOp, kind: ValueKind, value = ""): Cond => ({ left, op, right: { kind, value } });
const query = (patch: Partial<QueryState>): QueryState => ({ ...emptyQueryState(), ...patch });

export const presets: Preset[] = [
  {
    id: "empresas",
    label: "Empresas",
    state: query({
      from: { table: "TSIEMP", alias: "EMP" },
      select: [col("EMP.CODEMP"), col("EMP.NOMEFANTASIA")],
      orderBy: [{ expr: "EMP.CODEMP", dir: "ASC" }],
    }),
  },
  {
    id: "produtos-ativos",
    label: "Produtos ativos",
    state: query({
      from: { table: "TGFPRO", alias: "PRO" },
      select: [col("PRO.CODPROD"), col("PRO.DESCRPROD"), col("PRO.CODVOL")],
      where: { op: "AND", items: [cond("PRO.ATIVO", "=", "text", "S")] },
      orderBy: [{ expr: "PRO.DESCRPROD", dir: "ASC" }],
    }),
  },
  {
    id: "vendas-por-parceiro",
    label: "Vendas por parceiro no ano",
    state: query({
      from: { table: "TGFCAB", alias: "CAB" },
      joins: [
        {
          type: "INNER",
          table: "TGFPAR",
          alias: "PAR",
          on: { op: "AND", items: [cond("CAB.CODPARC", "=", "expr", "PAR.CODPARC")] },
        },
      ],
      select: [col("PAR.CODPARC"), col("PAR.NOMEPARC"), agg("COUNT", "", "QTD_NOTAS"), agg("SUM", "CAB.VLRNOTA", "TOTAL")],
      where: {
        op: "AND",
        items: [cond("CAB.TIPMOV", "=", "text", "V"), cond("CAB.DTNEG", ">=", "date", "2026-01-01")],
      },
      having: { op: "AND", items: [cond("SUM(CAB.VLRNOTA)", ">", "number", "0")] },
      orderBy: [{ expr: "TOTAL", dir: "DESC", nulls: "LAST" }],
      limit: { rows: 50, offset: 0, style: "fetch" },
    }),
  },
];
