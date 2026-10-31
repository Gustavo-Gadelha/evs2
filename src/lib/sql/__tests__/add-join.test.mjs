import assert from "node:assert/strict";
import { test } from "node:test";
import { addRelationJoin, prefixOf } from "../add-join.ts";
import { toOracleSql } from "../to-oracle.ts";
import { emptyQueryState } from "../query-state.ts";

const relation = { table: "TGFPAR", pairs: [{ column: "CODPARC", otherColumn: "CODPARC" }] };
const base = (from) => ({ ...emptyQueryState(), limit: null, from });

test("adiciona o JOIN com o prefixo do alias do FROM", () => {
  const next = addRelationJoin(base({ table: "TGFCAB", alias: "cab" }), "TGFCAB", relation);
  assert.equal(
    toOracleSql(next).sql,
    "SELECT *\nFROM TGFCAB CAB\n  INNER JOIN TGFPAR ON CAB.CODPARC = TGFPAR.CODPARC",
  );
});

test("sem alias, usa o nome da tabela como prefixo", () => {
  const next = addRelationJoin(base({ table: "TGFCAB", alias: "" }), "TGFCAB", relation);
  assert.equal(next.joins[0].on.items[0].left, "TGFCAB.CODPARC");
});

test("tabela de origem fora da consulta: não adiciona", () => {
  assert.equal(addRelationJoin(base({ table: "TGFPRO", alias: "" }), "TGFCAB", relation), null);
  assert.equal(prefixOf(base({ table: "TGFPRO", alias: "" }), "TGFCAB"), null);
});

test("tabela já presente ganha alias numerado", () => {
  const state = base({ table: "TGFCAB", alias: "" });
  const once = addRelationJoin(state, "TGFCAB", relation);
  const twice = addRelationJoin(once, "TGFCAB", relation);
  assert.equal(twice.joins[1].alias, "TGFPAR2");
  assert.equal(twice.joins[1].on.items[0].right.value, "TGFPAR2.CODPARC");
});

test("aceita OWNER.TABELA e vários pares de colunas", () => {
  const pair = { table: "TGFITE", pairs: [{ column: "NUNOTA", otherColumn: "NUNOTA" }, { column: "A", otherColumn: "B" }] };
  const next = addRelationJoin(base({ table: "SANKHYA.TGFCAB", alias: "c" }), "TGFCAB", pair);
  assert.equal(next.joins[0].on.items.length, 2);
  assert.equal(next.joins[0].on.items[1].left, "C.A");
});
