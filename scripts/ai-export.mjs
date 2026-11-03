// Exporta o índice do assistente para um NDJSON (`pnpm ai:export [base-url-normalizada]`), para levar do desktop ao
// notebook. Roda no host, contra o Postgres do compose (DATABASE_URL). Saída em `ai-export/` (ignorada pelo git/docker).
// Linha 1: cabeçalho (erpKey, modelo, dimensão, data); depois um documento por linha, com o vetor como array JSON.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import pg from "pg";

try {
  process.loadEnvFile();
} catch {}

const fail = (message) => {
  console.error(`ai:export: ${message}`);
  process.exit(1);
};

if (!process.env.DATABASE_URL) fail("defina DATABASE_URL no .env.");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect().catch((err) => fail(`não conectou ao Postgres (${err.code ?? err.message}).`));

try {
  const { rows: indexes } = await client.query(`SELECT * FROM "AiIndex" ORDER BY "erpKey"`).catch((err) => {
    if (err.code === "42P01") fail("tabelas não encontradas; suba o app uma vez para aplicar as migrations.");
    throw err;
  });
  const wanted = process.argv[2];
  const meta = wanted ? indexes.find((i) => i.erpKey === wanted) : indexes.length === 1 ? indexes[0] : null;
  if (!meta) {
    fail(
      indexes.length === 0
        ? "não há índice; gere um pela aplicação."
        : `informe o ERP: ${indexes.map((i) => i.erpKey).join(", ")}`,
    );
  }
  if (meta.dimension === 0) fail("o índice não terminou de ser gerado.");

  const { rows } = await client.query(
    `SELECT "kind", "ref", "title", "content", "embedding"::text AS "embedding"
     FROM "AiDocument" WHERE "erpKey" = $1 ORDER BY "kind", "ref"`,
    [meta.erpKey],
  );
  const header = {
    type: "header",
    erpKey: meta.erpKey,
    embedModel: meta.embedModel,
    dimension: meta.dimension,
    builtAt: meta.builtAt.toISOString(),
    count: rows.length,
  };
  const lines = [
    JSON.stringify(header),
    ...rows.map((r) => JSON.stringify({ ...r, embedding: JSON.parse(r.embedding) })),
  ];

  mkdirSync("ai-export", { recursive: true });
  const file = join("ai-export", `index-${meta.builtAt.toISOString().replace(/[:.]/g, "-")}.ndjson`);
  writeFileSync(file, `${lines.join("\n")}\n`);
  console.log(`ai:export: ${rows.length} documentos (${meta.embedModel}, ${meta.dimension}d) em ${file}`);
} finally {
  await client.end();
}
