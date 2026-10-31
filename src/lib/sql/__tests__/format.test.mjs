import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSql } from "../format.ts";
import { checkReadOnly } from "../read-only.ts";

test("formata em linhas e põe palavras-chave em maiúsculas", () => {
  assert.equal(
    formatSql("select a, b from tgfcab c where c.codemp = 1 and c.tipmov = 'V'"),
    "SELECT\n  a,\n  b\nFROM\n  tgfcab c\nWHERE\n  c.codemp = 1\n  AND c.tipmov = 'V'",
  );
});

test("é idempotente e não devolve nada quando já está formatado", () => {
  const once = formatSql("select a from t where b = 1");
  assert.ok(once);
  assert.equal(formatSql(once), null);
});

test("não altera literais nem comentários", () => {
  const out = formatSql("select 'a  b;  select' x, q'[it's  here]' y from dual -- fim  de  linha");
  assert.match(out, /'a {2}b;  select'/);
  assert.match(out, /q'\[it's {2}here\]'/);
  assert.match(out, /-- fim {2}de {2}linha/);
});

test("o SQL formatado passa na trava de leitura quando o original passava", () => {
  const sql = "with x as (select 1 n from dual) select n from x where n between 1 and 2";
  assert.deepEqual(checkReadOnly(sql), { ok: true });
  assert.deepEqual(checkReadOnly(formatSql(sql)), { ok: true });
});

test("texto vazio ou que não dá para formatar vira null", () => {
  assert.equal(formatSql(""), null);
  assert.equal(formatSql("   \n"), null);
  assert.equal(formatSql("select 'sem fechar"), null);
});
