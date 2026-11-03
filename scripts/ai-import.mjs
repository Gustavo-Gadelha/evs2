// Importa um índice gerado por `pnpm ai:export` (`pnpm ai:import [arquivo]`; sem argumento usa o mais recente de
// `ai-export/`). Recusa se o modelo de embeddings do arquivo divergir de AI_EMBED_MODEL (padrão bge-m3), porque vetores
// de modelos diferentes não são comparáveis. Substitui o índice do mesmo ERP. Roda no host, contra o Postgres do compose.

import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

try {
  process.loadEnvFile();
} catch {}

const fail = (message) => {
  console.error(`ai:import: ${message}`);
  process.exit(1);
};

if (!process.env.DATABASE_URL) fail("defina DATABASE_URL no .env.");

let file = process.argv[2];
if (!file) {
  const names = readdirSync("ai-export")
    .filter((n) => n.endsWith(".ndjson"))
    .sort();
  if (names.length === 0) fail("nenhum arquivo em ai-export/.");
  file = join("ai-export", names.at(-1));
}

const [headerLine, ...docLines] = readFileSync(file, "utf8").split("\n").filter(Boolean);
const header = JSON.parse(headerLine);
if (header.type !== "header") fail("arquivo inválido: falta o cabeçalho.");

const expected = process.env.AI_EMBED_MODEL || "bge-m3";
if (header.embedModel !== expected) {
  fail(`o índice usa "${header.embedModel}" e AI_EMBED_MODEL é "${expected}". Ajuste o .env ou reindexe.`);
}
if (docLines.length !== header.count) fail(`arquivo incompleto: ${docLines.length} de ${header.count} documentos.`);

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect().catch((err) => fail(`não conectou ao Postgres (${err.code ?? err.message}).`));

try {
  await client.query("BEGIN");
  await client.query(`DELETE FROM "AiDocument" WHERE "erpKey" = $1`, [header.erpKey]);
  for (const line of docLines) {
    const d = JSON.parse(line);
    if (d.embedding.length !== header.dimension) throw new Error(`dimensão inesperada em ${d.kind} ${d.ref}.`);
    await client.query(
      `INSERT INTO "AiDocument" ("id", "erpKey", "kind", "ref", "title", "content", "embedding")
       VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
      [randomUUID(), header.erpKey, d.kind, d.ref, d.title, d.content, `[${d.embedding.join(",")}]`],
    );
  }
  await client.query(
    `INSERT INTO "AiIndex" ("erpKey", "embedModel", "dimension", "builtAt", "stale") VALUES ($1, $2, $3, $4, false)
     ON CONFLICT ("erpKey") DO UPDATE SET "embedModel" = EXCLUDED."embedModel", "dimension" = EXCLUDED."dimension",
       "builtAt" = EXCLUDED."builtAt", "stale" = false`,
    [header.erpKey, header.embedModel, header.dimension, header.builtAt],
  );
  await client.query("COMMIT");
  console.log(
    `ai:import: ${docLines.length} documentos de ${header.erpKey} (${header.embedModel}, ${header.dimension}d).`,
  );
} catch (err) {
  await client.query("ROLLBACK");
  fail(err.code === "42P01" ? "tabelas não encontradas; suba o app uma vez para aplicar as migrations." : err.message);
} finally {
  await client.end();
}
