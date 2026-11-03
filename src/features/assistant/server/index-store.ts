import "server-only";

import { randomUUID } from "node:crypto";

import { aiConfig } from "./config";
import { db } from "@/lib/db/client";
import { Prisma } from "@/lib/db/generated/client";
import { normalizeBaseUrl, toVectorLiteral, type DocKind, type IndexDocument } from "@/lib/ai/documents";
import { AiIndexMismatchError, AiIndexMissingError } from "@/lib/ai/errors";
import { requireProfile } from "@/features/sankhya/server/auth";

// Acesso ao índice por SQL cru, sempre parametrizado (a coluna `vector` não existe no client do Prisma).

export type IndexMeta = { erpKey: string; embedModel: string; dimension: number; builtAt: Date; stale: boolean };
export type Hit = { kind: DocKind; ref: string; title: string; content: string; score: number };

export async function erpKeyOfActiveProfile(): Promise<string> {
  return normalizeBaseUrl((await requireProfile()).baseUrl);
}

export async function getMeta(erpKey: string): Promise<IndexMeta | null> {
  const row = await db().aiIndex.findUnique({ where: { erpKey } });
  return row;
}

export async function countDocuments(erpKey: string): Promise<{ table: number; column: number; query: number }> {
  const rows = await db().aiDocument.groupBy({ by: ["kind"], where: { erpKey }, _count: { _all: true } });
  const count = (kind: DocKind) => rows.find((r) => r.kind === kind)?._count._all ?? 0;
  return { table: count("table"), column: count("column"), query: count("query") };
}

export async function setMeta(meta: IndexMeta): Promise<void> {
  const { erpKey, ...data } = meta;
  await db().aiIndex.upsert({ where: { erpKey }, create: meta, update: data });
}

// Chamado pelo refresh do dicionário; sem índice, não há o que marcar.
export async function markIndexStale(): Promise<void> {
  const erpKey = await erpKeyOfActiveProfile();
  await db().aiIndex.updateMany({ where: { erpKey }, data: { stale: true } });
}

export async function deleteDocuments(erpKey: string): Promise<void> {
  await db().aiDocument.deleteMany({ where: { erpKey } });
}

export async function existingRefs(erpKey: string, kind: DocKind, refPrefix: string): Promise<Set<string>> {
  const rows = await db().aiDocument.findMany({
    where: { erpKey, kind, ref: { startsWith: refPrefix } },
    select: { ref: true },
  });
  return new Set(rows.map((r) => r.ref));
}

export async function upsertDocuments(erpKey: string, docs: IndexDocument[], vectors: number[][]): Promise<void> {
  if (docs.length === 0) return;
  await db().$transaction(
    docs.map(
      (doc, i) => db().$executeRaw`
        INSERT INTO "AiDocument" ("id", "erpKey", "kind", "ref", "title", "content", "embedding")
        VALUES (${randomUUID()}, ${erpKey}, ${doc.kind}, ${doc.ref}, ${doc.title}, ${doc.content},
                ${toVectorLiteral(vectors[i])}::vector)
        ON CONFLICT ("erpKey", "kind", "ref") DO UPDATE
          SET "title" = EXCLUDED."title", "content" = EXCLUDED."content", "embedding" = EXCLUDED."embedding"`,
    ),
  );
}

// Recusa em vez de devolver lixo: vetores de modelos ou dimensões diferentes não são comparáveis.
export async function requireUsableIndex(erpKey: string): Promise<IndexMeta> {
  const meta = await getMeta(erpKey);
  if (!meta) throw new AiIndexMissingError("O dicionário ainda não foi indexado. Gere o índice antes de perguntar.");
  const { embedModel } = aiConfig();
  if (meta.embedModel !== embedModel) {
    throw new AiIndexMismatchError(
      `O índice foi gerado com "${meta.embedModel}" e a configuração usa "${embedModel}". Reindexe ou ajuste AI_EMBED_MODEL.`,
    );
  }
  return meta;
}

type Filter = { kinds: DocKind[]; refPrefix?: string };

const where = (erpKey: string, { kinds, refPrefix }: Filter) => Prisma.sql`
  "erpKey" = ${erpKey} AND "kind" IN (${Prisma.join(kinds)})
  ${refPrefix ? Prisma.sql`AND "ref" LIKE ${refPrefix.replace(/[\\%_]/g, "\\$&") + "%"}` : Prisma.empty}`;

// Similaridade de cosseno (1 - distância), do mais parecido ao menos.
export async function vectorSearch(erpKey: string, filter: Filter, vector: number[], limit: number): Promise<Hit[]> {
  const literal = toVectorLiteral(vector);
  return db().$queryRaw<Hit[]>`
    SELECT "kind", "ref", "title", "content", 1 - ("embedding" <=> ${literal}::vector) AS "score"
    FROM "AiDocument"
    WHERE ${where(erpKey, filter)}
    ORDER BY "embedding" <=> ${literal}::vector
    LIMIT ${limit}`;
}

// `tsquery` já vem montado e saneado por `toTsQuery` (termos `[a-z0-9_]` unidos por `|`).
export async function textSearch(erpKey: string, filter: Filter, tsquery: string, limit: number): Promise<Hit[]> {
  if (!tsquery) return [];
  return db().$queryRaw<Hit[]>`
    SELECT d."kind", d."ref", d."title", d."content", ts_rank(v.doc, q.query)::float8 AS "score"
    FROM "AiDocument" d
    CROSS JOIN to_tsquery('simple', ${tsquery}) q(query)
    CROSS JOIN LATERAL (SELECT to_tsvector('simple', unaccent(d."title" || ' ' || d."content")) AS doc) v
    WHERE ${where(erpKey, filter)}
      AND v.doc @@ q.query
    ORDER BY "score" DESC
    LIMIT ${limit}`;
}
