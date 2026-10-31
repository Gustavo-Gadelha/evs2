import assert from "node:assert/strict";
import { test } from "node:test";
import { checkReadOnly } from "../read-only.ts";

const accepted = [
  "SELECT * FROM TGFCAB",
  "  select 1 from dual",
  "WITH x AS (SELECT 1 FROM DUAL) SELECT * FROM x",
  "SELECT 'DELETE; DROP TABLE x' FROM DUAL",
  "SELECT q'[INSERT ; ]' FROM DUAL",
  'SELECT "UPDATE" FROM T',
  "SELECT 1 FROM DUAL -- DROP TABLE x",
  "SELECT /* DELETE ; */ 1 FROM DUAL",
  "SELECT UPDATED_AT, CREATED FROM T",
  "SELECT 'it''s; ok' FROM DUAL",
];

const refused = [
  "",
  "   ",
  "DELETE FROM T",
  "UPDATE T SET A = 1",
  "SELECT 1 FROM DUAL;",
  "SELECT 1 FROM DUAL; DROP TABLE T",
  "SELECT * FROM T FOR UPDATE",
  "SELECT 1 FROM DUAL WHERE 1 = 1 UNION SELECT 1 FROM DUAL; SELECT 2 FROM DUAL",
  "BEGIN NULL; END",
  "CALL proc()",
  "SELECT 'aberta FROM DUAL",
  "SELECT 1 /* sem fechar",
  "SELECT 1 FROM DUAL /* ok */ ; ",
  "SELECT insert FROM T",
  "EXPLAIN PLAN FOR SELECT 1 FROM DUAL",
];

for (const sql of accepted) test(`aceita: ${sql}`, () => assert.deepEqual(checkReadOnly(sql), { ok: true }));
for (const sql of refused) test(`recusa: ${JSON.stringify(sql)}`, () => assert.equal(checkReadOnly(sql).ok, false));
