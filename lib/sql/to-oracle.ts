// Gera o SQL Oracle a partir do QueryState. Função pura: com problemas, devolve `sql` vazio e a lista
// de problemas por seção, em vez de SQL quebrado. Linhas em branco do builder são ignoradas.
// Só `import type`, para que `lib/sql/` rode direto no Node nas verificações.

import type { Cond, CondGroup, Expr, Limit, Problem, QueryState, Section } from "./query-state";

const IDENT = /^[A-Z_][A-Z0-9_$#]*$/;
// Tabela com owner opcional: TGFCAB ou SANKHYA.TGFCAB.
const TABLE = /^[A-Z_][A-Z0-9_$#]*(\.[A-Z_][A-Z0-9_$#]*)?$/;
const NUMBER = /^-?\d+(\.\d+)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type SqlResult = { sql: string; problems: Problem[] };

type Problems = Problem[];

function indent(text: string, spaces = 2): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => pad + line)
    .join("\n");
}

function literal(kind: Cond["right"]["kind"], raw: string, section: Section, problems: Problems): string | null {
  const value = raw.trim();
  switch (kind) {
    case "text":
      return `'${raw.replaceAll("'", "''")}'`;
    case "number":
      if (NUMBER.test(value)) return value;
      problems.push({ section, message: `Número inválido: "${raw}".` });
      return null;
    case "date":
      if (DATE.test(value)) return `TO_DATE('${value}', 'YYYY-MM-DD')`;
      problems.push({ section, message: `Data inválida: "${raw}" (use AAAA-MM-DD).` });
      return null;
    case "expr":
      if (value) return value;
      problems.push({ section, message: "Expressão vazia no lado direito de uma condição." });
      return null;
  }
}

function condition(cond: Cond, section: Section, problems: Problems): string | null {
  const left = cond.left.trim();
  if (!left) return null;

  const { op, right } = cond;
  if (op === "IS NULL" || op === "IS NOT NULL") return `${left} ${op}`;

  if (op === "IN" || op === "NOT IN") {
    const parts = right.value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length === 0) {
      problems.push({ section, message: `${op} sem valores em ${left}.` });
      return null;
    }
    const values = parts.map((part) => literal(right.kind, part, section, problems));
    return values.includes(null) ? null : `${left} ${op} (${values.join(", ")})`;
  }

  if (op === "BETWEEN") {
    if (!right.value2?.trim()) {
      problems.push({ section, message: `BETWEEN sem o segundo valor em ${left}.` });
      return null;
    }
    const from = literal(right.kind, right.value, section, problems);
    const to = literal(right.kind, right.value2, section, problems);
    return from === null || to === null ? null : `${left} BETWEEN ${from} AND ${to}`;
  }

  const value = literal(right.kind, right.value, section, problems);
  return value === null ? null : `${left} ${op} ${value}`;
}

// Condições efetivas de um grupo; subgrupos com mais de uma condição viram parênteses, vazios somem.
function conditions(group: CondGroup, section: Section, problems: Problems): string[] {
  const parts: string[] = [];
  for (const item of group.items) {
    if (item.off) continue;
    if ("items" in item) {
      const inner = conditions(item, section, problems);
      if (inner.length === 1) parts.push(inner[0]);
      else if (inner.length > 1) parts.push(`(${inner.join(` ${item.op} `)})`);
    } else {
      const sql = condition(item, section, problems);
      if (sql) parts.push(sql);
    }
  }
  return parts;
}

function conditionClause(keyword: string, group: CondGroup, section: Section, problems: Problems): string | null {
  const parts = conditions(group, section, problems);
  return parts.length ? `${keyword} ${parts.join(`\n  ${group.op} `)}` : null;
}

function expression(expr: Expr, problems: Problems): string | null {
  if (expr.kind === "raw") return expr.sql.trim() || null;

  const arg = expr.arg.trim();
  if (!arg) {
    if (expr.fn === "COUNT") return "COUNT(*)";
    problems.push({ section: "select", message: `${expr.fn} sem argumento.` });
    return null;
  }
  const distinct = expr.distinct ? "DISTINCT " : "";
  if (expr.fn === "LISTAGG") return `LISTAGG(${distinct}${arg}, ', ') WITHIN GROUP (ORDER BY ${arg})`;
  return `${expr.fn}(${distinct}${arg})`;
}

// Alias simples sai sem aspas e em maiúsculas; com espaço ou acento, entre aspas duplas.
function columnAlias(alias: string | undefined): string {
  const value = alias?.trim();
  if (!value) return "";
  const upper = value.toUpperCase();
  return IDENT.test(upper) ? ` AS ${upper}` : ` AS "${value.replaceAll('"', "")}"`;
}

function tableRef(table: string, alias: string, section: Section, problems: Problems): string | null {
  const name = table.trim().toUpperCase();
  const short = alias.trim().toUpperCase();
  if (!TABLE.test(name)) {
    problems.push({ section, message: `Nome de tabela inválido: "${table.trim()}".` });
    return null;
  }
  if (short && !IDENT.test(short)) {
    problems.push({ section, message: `Alias inválido: "${alias.trim()}".` });
    return null;
  }
  return short ? `${name} ${short}` : name;
}

// Expressões do GROUP BY: no modo automático, todas as colunas não agregadas quando há agregação no SELECT.
export function groupByExprs(state: QueryState): string[] {
  if (state.groupBy.mode === "manual") return state.groupBy.exprs.map((expr) => expr.trim()).filter(Boolean);
  if (!state.select.some((item) => !item.off && item.expr.kind === "agg")) return [];
  return state.select.flatMap((item) =>
    !item.off && item.expr.kind === "raw" && item.expr.sql.trim() ? [item.expr.sql.trim()] : [],
  );
}

function applyLimit(sql: string, limit: Limit | null, problems: Problems): string {
  if (!limit) return sql;

  const { rows, offset, style } = limit;
  if (!Number.isInteger(rows) || rows <= 0) {
    problems.push({ section: "limit", message: "O limite de linhas deve ser um inteiro maior que 0." });
    return sql;
  }
  if (!Number.isInteger(offset) || offset < 0) {
    problems.push({ section: "limit", message: "O offset deve ser um inteiro maior ou igual a 0." });
    return sql;
  }

  if (style === "fetch") {
    const lines = [sql];
    if (offset > 0) lines.push(`OFFSET ${offset} ROWS`);
    lines.push(`FETCH NEXT ${rows} ROWS ONLY`);
    return lines.join("\n");
  }

  // ROWNUM (Oracle 11g): o ORDER BY precisa ficar dentro da subconsulta para o limite respeitá-lo.
  if (offset === 0) return ["SELECT * FROM (", indent(sql), ")", `WHERE ROWNUM <= ${rows}`].join("\n");
  return [
    "SELECT * FROM (",
    "  SELECT Q.*, ROWNUM RNUM FROM (",
    indent(sql, 4),
    "  ) Q",
    `  WHERE ROWNUM <= ${offset + rows}`,
    ")",
    `WHERE RNUM > ${offset}`,
  ].join("\n");
}

export function toOracleSql(state: QueryState): SqlResult {
  const problems: Problems = [];
  const lines: string[] = [];
  // Seções omitidas saem do SQL sem sair do estado; os problemas delas também são ignorados.
  const omitted = new Set(state.omit ?? []);

  const columns = (omitted.has("select") ? [] : state.select).flatMap((item) => {
    if (item.off) return [];
    const sql = expression(item.expr, problems);
    return sql ? [`${sql}${columnAlias(item.alias)}`] : [];
  });
  const head = state.distinct ? "SELECT DISTINCT" : "SELECT";
  lines.push(columns.length ? `${head}\n${columns.map((column) => `  ${column}`).join(",\n")}` : `${head} *`);

  if (!state.from.table.trim()) {
    problems.push({ section: "from", message: "Informe a tabela do FROM." });
  } else {
    const ref = tableRef(state.from.table, state.from.alias, "from", problems);
    if (ref) lines.push(`FROM ${ref}`);
  }

  for (const join of omitted.has("joins") ? [] : state.joins) {
    if (join.off || !join.table.trim()) continue;
    const ref = tableRef(join.table, join.alias, "joins", problems);
    const on = conditions(join.on, "joins", problems);
    if (on.length === 0) {
      problems.push({ section: "joins", message: `JOIN ${join.table.trim().toUpperCase()} sem condição ON.` });
      continue;
    }
    if (ref) lines.push(`  ${join.type} JOIN ${ref} ON ${on.join(` ${join.on.op} `)}`);
  }

  const where = omitted.has("where") ? null : conditionClause("WHERE", state.where, "where", problems);
  if (where) lines.push(where);

  const groupBy = omitted.has("groupBy") ? [] : groupByExprs(state);
  if (groupBy.length) lines.push(`GROUP BY\n${groupBy.map((expr) => `  ${expr}`).join(",\n")}`);

  const having = omitted.has("having") ? null : conditionClause("HAVING", state.having, "having", problems);
  if (having) {
    if (groupBy.length) lines.push(having);
    else
      problems.push({
        section: "having",
        message: "HAVING exige GROUP BY: adicione uma agregação no SELECT ou use o GROUP BY manual.",
      });
  }

  const order = (omitted.has("orderBy") ? [] : state.orderBy).flatMap((item) => {
    const expr = item.off ? "" : item.expr.trim();
    return expr ? [`${expr} ${item.dir}${item.nulls ? ` NULLS ${item.nulls}` : ""}`] : [];
  });
  if (order.length) lines.push(`ORDER BY ${order.join(", ")}`);

  const sql = applyLimit(lines.join("\n"), omitted.has("limit") ? null : state.limit, problems);
  return { sql: problems.length ? "" : sql, problems };
}
