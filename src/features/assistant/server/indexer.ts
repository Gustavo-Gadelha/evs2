import "server-only";

import { aiConfig } from "./config";
import { deleteDocuments, erpKeyOfActiveProfile, existingRefs, setMeta, upsertDocuments } from "./index-store";
import { embed } from "./ollama";
import type { IndexEvent } from "../index-protocol";
import { columnDocument, queryDocument, tableDocument, type IndexDocument } from "@/lib/ai/documents";
import { AiIndexBusyError } from "@/lib/ai/errors";
import { db } from "@/lib/db/client";
import { listColumns, listTables, tableName } from "@/features/dictionary/server/dictionary";

const BATCH = 32;

// Uma indexação por vez (no globalThis, para sobreviver ao HMR): na CPU cada uma é longa.
const g = globalThis as typeof globalThis & { __aiIndexing?: Set<string> };
export const isIndexing = (erpKey: string) => g.__aiIndexing?.has(erpKey) ?? false;

type Progress = (event: IndexEvent) => void;

async function embedAndStore(
  erpKey: string,
  docs: IndexDocument[],
  phase: "tables" | "queries",
  progress: Progress,
  signal?: AbortSignal,
): Promise<{ dimension: number; embedMs: number }> {
  let dimension = 0;
  let embedMs = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    signal?.throwIfAborted();
    const batch = docs.slice(i, i + BATCH);
    const started = performance.now();
    const vectors = await embed(
      batch.map((d) => d.embedText),
      signal,
    );
    embedMs += performance.now() - started;
    dimension = vectors[0]?.length ?? dimension;
    await upsertDocuments(erpKey, batch, vectors);
    progress({ type: "progress", phase, done: Math.min(i + BATCH, docs.length), total: docs.length });
  }
  return { dimension, embedMs };
}

// (Re)constrói o índice do ERP do perfil ativo: uma entrada por tabela do TDDTAB e as consultas salvas como
// exemplos. As colunas não entram aqui (TDDCAM é grande): `ensureColumns` as indexa sob demanda.
export async function buildIndex(progress: Progress, signal?: AbortSignal): Promise<void> {
  const erpKey = await erpKeyOfActiveProfile();
  const running = (g.__aiIndexing ??= new Set());
  if (running.has(erpKey)) throw new AiIndexBusyError("Já existe uma indexação em andamento para este ERP.");
  running.add(erpKey);

  try {
    const { embedModel } = aiConfig();
    const tables = (await listTables()).map((t) => tableDocument(t.name, t.description));
    const saved = (await db().savedQuery.findMany({ orderBy: { savedAt: "desc" } })).map((q) =>
      queryDocument(q.id, q.name, q.sql),
    );

    // Marca como desatualizado enquanto reconstrói: se for cancelado no meio, o índice não finge estar pronto.
    await deleteDocuments(erpKey);
    const stub = { erpKey, embedModel, dimension: 0, builtAt: new Date(), stale: true };
    await setMeta(stub);

    const a = await embedAndStore(erpKey, tables, "tables", progress, signal);
    const b = await embedAndStore(erpKey, saved, "queries", progress, signal);
    const dimension = a.dimension || b.dimension;
    await setMeta({ ...stub, dimension, builtAt: new Date(), stale: false });
    progress({ type: "done", documents: tables.length + saved.length, embedMs: Math.round(a.embedMs + b.embedMs) });
  } finally {
    running.delete(erpKey);
  }
}

// Indexa, uma vez e sob demanda, as colunas de uma tabela já recuperada (cache na mesma tabela de vetores).
export async function ensureColumns(table: string, signal?: AbortSignal): Promise<void> {
  const erpKey = await erpKeyOfActiveProfile();
  const name = tableName(table);
  const columns = await listColumns(name);
  const have = await existingRefs(erpKey, "column", `${name}.`);
  const missing = columns.map((c) => columnDocument(name, c.name, c.description)).filter((doc) => !have.has(doc.ref));
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const vectors = await embed(
      batch.map((d) => d.embedText),
      signal,
    );
    await upsertDocuments(erpKey, batch, vectors);
  }
}
