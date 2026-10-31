import assert from "node:assert/strict";
import { test } from "node:test";
import { toOracleSql } from "../to-oracle.ts";
import { emptyQueryState } from "../query-state.ts";

const cond = (left, op, kind, value, value2) => ({ left, op, right: { kind, value, value2 } });
const group = (op, ...items) => ({ op, items });
const build = (patch) => toOracleSql({ ...emptyQueryState(), limit: null, ...patch });

test("FROM sem tabela vira problema e não gera SQL", () => {
  const { sql, problems } = build({});
  assert.equal(sql, "");
  assert.deepEqual(problems, [{ section: "from", message: "Informe a tabela do FROM." }]);
});

test("sem colunas gera SELECT * e converte tabela e alias para maiúsculas", () => {
  assert.equal(build({ from: { table: "tgfcab", alias: "c" } }).sql, "SELECT *\nFROM TGFCAB C");
});

test("join + agregação + HAVING, com GROUP BY automático", () => {
  const { sql, problems } = build({
    from: { table: "TGFCAB", alias: "CAB" },
    joins: [
      {
        type: "LEFT",
        table: "TGFPAR",
        alias: "PAR",
        on: group("AND", cond("PAR.CODPARC", "=", "expr", "CAB.CODPARC")),
      },
    ],
    select: [
      { expr: { kind: "raw", sql: "PAR.NOMEPARC" } },
      { expr: { kind: "agg", fn: "SUM", arg: "CAB.VLRNOTA", distinct: false }, alias: "total" },
    ],
    having: group("AND", cond("SUM(CAB.VLRNOTA)", ">", "number", "1000")),
  });
  assert.deepEqual(problems, []);
  assert.equal(
    sql,
    [
      "SELECT",
      "  PAR.NOMEPARC,",
      "  SUM(CAB.VLRNOTA) AS TOTAL",
      "FROM TGFCAB CAB",
      "  LEFT JOIN TGFPAR PAR ON PAR.CODPARC = CAB.CODPARC",
      "GROUP BY",
      "  PAR.NOMEPARC",
      "HAVING SUM(CAB.VLRNOTA) > 1000",
    ].join("\n"),
  );
});

test("WHERE aninhado põe parênteses só em subgrupos com mais de uma condição", () => {
  const { sql } = build({
    from: { table: "TGFCAB", alias: "" },
    where: group(
      "AND",
      cond("TIPMOV", "=", "text", "V"),
      group("OR", cond("CODEMP", "=", "number", "1"), cond("CODEMP", "=", "number", "2")),
      group("OR", cond("STATUS", "IS NULL", "text", "")),
    ),
  });
  assert.equal(
    sql,
    "SELECT *\nFROM TGFCAB\nWHERE TIPMOV = 'V'\n  AND (CODEMP = 1 OR CODEMP = 2)\n  AND STATUS IS NULL",
  );
});

test("valores: escape de aspas, data, IN e BETWEEN", () => {
  const { sql, problems } = build({
    from: { table: "TGFPAR", alias: "" },
    where: group(
      "AND",
      cond("NOMEPARC", "LIKE", "text", "D'AVILA%"),
      cond("DTCAD", "BETWEEN", "date", "2024-01-01", "2024-12-31"),
      cond("CODPARC", "IN", "number", "1, 2,3"),
    ),
  });
  assert.deepEqual(problems, []);
  assert.match(sql, /NOMEPARC LIKE 'D''AVILA%'/);
  assert.match(sql, /DTCAD BETWEEN TO_DATE\('2024-01-01', 'YYYY-MM-DD'\) AND TO_DATE\('2024-12-31', 'YYYY-MM-DD'\)/);
  assert.match(sql, /CODPARC IN \(1, 2, 3\)/);
});

test("problemas: número inválido, BETWEEN sem valor2, IN vazio, join sem ON, HAVING sem GROUP BY", () => {
  const { sql, problems } = build({
    from: { table: "TGFCAB", alias: "" },
    joins: [{ type: "INNER", table: "TGFPAR", alias: "P", on: group("AND") }],
    where: group(
      "AND",
      cond("A", "=", "number", "abc"),
      cond("B", "BETWEEN", "number", "1"),
      cond("C", "IN", "number", " , "),
    ),
    having: group("AND", cond("COUNT(*)", ">", "number", "1")),
  });
  assert.equal(sql, "");
  assert.deepEqual(
    problems.map((p) => p.section).sort(),
    ["having", "joins", "where", "where", "where"],
  );
});

test("limite fetch, com e sem offset", () => {
  const base = { from: { table: "T", alias: "" } };
  assert.equal(build({ ...base, limit: { rows: 10, offset: 0, style: "fetch" } }).sql, "SELECT *\nFROM T\nFETCH NEXT 10 ROWS ONLY");
  assert.equal(
    build({ ...base, limit: { rows: 10, offset: 20, style: "fetch" } }).sql,
    "SELECT *\nFROM T\nOFFSET 20 ROWS\nFETCH NEXT 10 ROWS ONLY",
  );
});

test("limite rownum, com e sem offset", () => {
  const base = { from: { table: "T", alias: "" } };
  assert.equal(
    build({ ...base, limit: { rows: 10, offset: 0, style: "rownum" } }).sql,
    "SELECT * FROM (\n  SELECT *\n  FROM T\n)\nWHERE ROWNUM <= 10",
  );
  assert.equal(
    build({ ...base, limit: { rows: 10, offset: 20, style: "rownum" } }).sql,
    "SELECT * FROM (\n  SELECT Q.*, ROWNUM RNUM FROM (\n    SELECT *\n    FROM T\n  ) Q\n  WHERE ROWNUM <= 30\n)\nWHERE RNUM > 20",
  );
});

test("limite <= 0 é problema", () => {
  const { problems } = build({ from: { table: "T", alias: "" }, limit: { rows: 0, offset: 0, style: "fetch" } });
  assert.equal(problems[0].section, "limit");
});

test("seções e itens omitidos saem do SQL; WHERE e HAVING vazios não deixam linhas", () => {
  const { sql, problems } = build({
    from: { table: "T", alias: "" },
    select: [{ expr: { kind: "raw", sql: "A" } }, { off: true, expr: { kind: "raw", sql: "B" } }],
    where: group("AND", cond("X", "=", "number", "oops")),
    omit: ["where"],
  });
  assert.deepEqual(problems, []);
  assert.equal(sql, "SELECT\n  A\nFROM T");
});

test("COUNT sem argumento vira COUNT(*) e LISTAGG usa WITHIN GROUP", () => {
  const { sql } = build({
    from: { table: "T", alias: "" },
    select: [
      { expr: { kind: "agg", fn: "COUNT", arg: "", distinct: false } },
      { expr: { kind: "agg", fn: "LISTAGG", arg: "NOME", distinct: false } },
    ],
  });
  assert.match(sql, /COUNT\(\*\)/);
  assert.match(sql, /LISTAGG\(NOME, ', '\) WITHIN GROUP \(ORDER BY NOME\)/);
});
