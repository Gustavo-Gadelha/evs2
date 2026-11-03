import assert from "node:assert/strict";
import test from "node:test";

import {
  columnDocument,
  normalizeBaseUrl,
  queryDocument,
  tableDocument,
  textQueryTerms,
  toTsQuery,
  toVectorLiteral,
} from "../documents.ts";

test("normalizeBaseUrl ignora caixa, barra final e credenciais de perfil", () => {
  assert.equal(normalizeBaseUrl("https://ERP.exemplo.com.br/"), "https://erp.exemplo.com.br");
  assert.equal(
    normalizeBaseUrl(" https://erp.exemplo.com.br:8180/sankhya/ "),
    "https://erp.exemplo.com.br:8180/sankhya",
  );
  assert.equal(normalizeBaseUrl("https://erp.exemplo.com.br"), normalizeBaseUrl("https://erp.exemplo.com.br/"));
});

test("documentos de tabela, coluna e consulta", () => {
  assert.deepEqual(tableDocument("TGFCAB", "Cabeçalho da Nota"), {
    kind: "table",
    ref: "TGFCAB",
    title: "TGFCAB",
    content: "Cabeçalho da Nota",
    embedText: "TGFCAB: Cabeçalho da Nota",
  });
  assert.equal(columnDocument("TGFCAB", "NUNOTA", "Número único").ref, "TGFCAB.NUNOTA");
  assert.equal(queryDocument("1", "Notas", "x".repeat(2000)).content.length, 1500);
});

test("toVectorLiteral", () => {
  assert.equal(toVectorLiteral([1, 0.5, -2]), "[1,0.5,-2]");
});

test("textQueryTerms tira acento, stopwords e duplicados; mantém nomes de tabela", () => {
  assert.deepEqual(textQueryTerms("Valor total das notas de venda por vendedor, nota TGFCAB"), [
    "valor",
    "total",
    "notas",
    "venda",
    "vendedor",
    "nota",
    "tgfcab",
  ]);
  assert.equal(toTsQuery("cabeçalho da NOTA"), "cabecalho | nota");
});

test("toTsQuery neutraliza operadores do tsquery", () => {
  assert.equal(toTsQuery("a' | b & !c:*"), "");
  assert.equal(toTsQuery("nota'); drop"), "nota | drop");
});
