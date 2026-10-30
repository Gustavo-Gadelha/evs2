// Estado serializável do builder visual: é o que vai para o histórico, e as consultas salvas.
// Sem imports em runtime, para que `lib/sql/` rode direto no Node nas verificações.

export const JOIN_TYPES = ["INNER", "LEFT", "RIGHT", "FULL"] as const;
export const AGG_FNS = ["COUNT", "SUM", "AVG", "MIN", "MAX", "LISTAGG"] as const;
export const COND_OPS = [
  "=",
  "<>",
  "<",
  "<=",
  ">",
  ">=",
  "LIKE",
  "NOT LIKE",
  "IN",
  "NOT IN",
  "BETWEEN",
  "IS NULL",
  "IS NOT NULL",
] as const;
export const VALUE_KINDS = ["text", "number", "date", "expr"] as const;

export type JoinType = (typeof JOIN_TYPES)[number];
export type AggFn = (typeof AGG_FNS)[number];
export type CondOp = (typeof COND_OPS)[number];
export type ValueKind = (typeof VALUE_KINDS)[number];

export type Expr = { kind: "raw"; sql: string } | { kind: "agg"; fn: AggFn; arg: string; distinct: boolean };
export type AggExpr = Extract<Expr, { kind: "agg" }>;

// `off` omite o item do SQL gerado sem removê-lo do builder (opcional: consultas antigas não têm).
export type Cond = {
  off?: boolean;
  left: string;
  op: CondOp;
  right: { kind: ValueKind; value: string; value2?: string };
};
export type CondGroup = { off?: boolean; op: "AND" | "OR"; items: (Cond | CondGroup)[] };

export type Join = { off?: boolean; type: JoinType; table: string; alias: string; on: CondGroup };
export type SelectItem = { off?: boolean; expr: Expr; alias?: string };
export type OrderItem = { off?: boolean; expr: string; dir: "ASC" | "DESC"; nulls?: "FIRST" | "LAST" };
export type Limit = { rows: number; offset: number; style: "fetch" | "rownum" };

export type QueryState = {
  from: { table: string; alias: string };
  joins: Join[];
  distinct: boolean;
  select: SelectItem[];
  where: CondGroup;
  groupBy: { mode: "auto" | "manual"; exprs: string[] };
  having: CondGroup;
  orderBy: OrderItem[];
  limit: Limit | null;
  // Seções ignoradas na geração do SQL, mas mantidas no estado (opcional: consultas antigas não têm).
  omit?: OmittableSection[];
};

export type Section = "from" | "joins" | "select" | "where" | "groupBy" | "having" | "orderBy" | "limit";
export type OmittableSection = Exclude<Section, "from">;

export const OMITTABLE_SECTIONS: { section: OmittableSection; label: string }[] = [
  { section: "joins", label: "JOINS" },
  { section: "select", label: "Colunas (SELECT *)" },
  { section: "where", label: "WHERE" },
  { section: "groupBy", label: "GROUP BY" },
  { section: "having", label: "HAVING" },
  { section: "orderBy", label: "ORDER BY" },
  { section: "limit", label: "Limite (FETCH NEXT)" },
];
export type Problem = { section: Section; message: string };

export const DEFAULT_LIMIT: Limit = { rows: 100, offset: 0, style: "fetch" };

export function emptyCond(): Cond {
  return { left: "", op: "=", right: { kind: "text", value: "" } };
}

export function emptyGroup(op: CondGroup["op"] = "AND"): CondGroup {
  return { op, items: [] };
}

export function emptyQueryState(): QueryState {
  return {
    from: { table: "", alias: "" },
    joins: [],
    distinct: false,
    select: [],
    where: emptyGroup(),
    groupBy: { mode: "auto", exprs: [] },
    having: emptyGroup(),
    orderBy: [],
    limit: { ...DEFAULT_LIMIT },
  };
}

export function isCondGroup(item: Cond | CondGroup): item is CondGroup {
  return "items" in item;
}
