// Estado serializável do builder visual: é o que vai para o histórico, as consultas salvas e `presets.ts`.
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

export type Cond = {
  left: string;
  op: CondOp;
  right: { kind: ValueKind; value: string; value2?: string };
};
export type CondGroup = { op: "AND" | "OR"; items: (Cond | CondGroup)[] };

export type Join = { type: JoinType; table: string; alias: string; on: CondGroup };
export type SelectItem = { expr: Expr; alias?: string };
export type OrderItem = { expr: string; dir: "ASC" | "DESC"; nulls?: "FIRST" | "LAST" };
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
};

export type Section = "from" | "joins" | "select" | "where" | "groupBy" | "having" | "orderBy" | "limit";
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
