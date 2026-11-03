import "server-only";

import { aiConfig } from "./config";
import {
  deleteColumnsOfTables,
  deleteDocuments,
  deleteRefs,
  documentHash,
  erpKeyOfActiveProfile,
  existingHashes,
  getMeta,
  setMeta,
  upsertDocuments,
} from "./index-store";
import { embed } from "./ollama";
import type { IndexEvent } from "../index-protocol";
import { columnDocument, queryDocument, tableDocument, type IndexDocument } from "@/lib/ai/documents";
import { AiIndexBusyError } from "@/lib/ai/errors";
import { db } from "@/lib/db/client";
import { listColumns, listTables, tableName } from "@/features/dictionary/server/dictionary";

const BATCH = 32;
// Lotes em voo ao mesmo tempo: enquanto um grava no Postgres, o próximo já está no Ollama. Com `OLLAMA_NUM_PARALLEL=1`
// o Ollama enfileira os embeddings (não acelera o cálculo, só esconde a gravação); com mais paralelismo no Ollama, soma.
const CONCURRENCY = 2;

// Uma indexação por vez (no globalThis, para sobreviver ao HMR): na CPU cada uma é longa.
const g = globalThis as typeof globalThis & { __aiIndexing?: Set<string> };
export const isIndexing = (erpKey: string) => g.__aiIndexing?.has(erpKey) ?? false;

type Progress = (event: IndexEvent) => void;

// Embeda e grava os documentos em lotes, com até `CONCURRENCY` lotes em andamento. Se um lote falha, os demais
// são abortados (senão continuariam consumindo o Ollama depois do erro).
async function embedAndStore(
  erpKey: string,
  docs: IndexDocument[],
  onDone: (done: number) => void,
  signal?: AbortSignal,
): Promise<{ dimension: number; embedMs: number }> {
  const batches: IndexDocument[][] = [];
  for (let i = 0; i < docs.length; i += BATCH) batches.push(docs.slice(i, i + BATCH));

  const failure = new AbortController();
  const stop = signal ? AbortSignal.any([signal, failure.signal]) : failure.signal;
  const started = performance.now();
  let next = 0;
  let done = 0;
  let dimension = 0;

  async function worker() {
    try {
      for (let i = next++; i < batches.length; i = next++) {
        stop.throwIfAborted();
        const batch = batches[i];
        const vectors = await embed(
          batch.map((d) => d.embedText),
          stop,
        );
        dimension ||= vectors[0]?.length ?? 0;
        await upsertDocuments(erpKey, batch, vectors);
        done += batch.length;
        onDone(done);
      }
    } catch (err) {
      failure.abort();
      throw err;
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  return { dimension, embedMs: performance.now() - started };
}

// Compara os documentos atuais com os já indexados: embeda só os novos ou alterados (hash do texto diferente) e
// remove os que saíram do dicionário.
async function syncKind(
  erpKey: string,
  kind: "table" | "query",
  docs: IndexDocument[],
  reuse: boolean,
  progress: Progress,
  signal?: AbortSignal,
): Promise<{ dimension: number; embedMs: number; embedded: number }> {
  const existing = reuse ? await existingHashes(erpKey, kind) : new Map<string, string | null>();
  const current = new Set(docs.map((d) => d.ref));

  const removed = [...existing.keys()].filter((ref) => !current.has(ref));
  await deleteRefs(erpKey, kind, removed);
  if (kind === "table") await deleteColumnsOfTables(erpKey, removed);

  const changed = docs.filter((d) => existing.get(d.ref) !== documentHash(d));
  const phase = kind === "table" ? "tables" : "queries";
  const result = await embedAndStore(
    erpKey,
    changed,
    (done) => progress({ type: "progress", phase, done, total: changed.length }),
    signal,
  );
  return { ...result, embedded: changed.length };
}

// Atualiza o índice do ERP do perfil ativo: uma entrada por tabela do TDDTAB e as consultas salvas como exemplos.
// É incremental: com o mesmo modelo de embeddings, só o que mudou desde a última vez é recalculado. As colunas não
// entram aqui (TDDCAM é grande): `ensureColumns` as indexa sob demanda.
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

    // Vetores de modelos diferentes não se misturam: trocou o modelo, recomeça do zero.
    const meta = await getMeta(erpKey);
    const reuse = meta !== null && meta.embedModel === embedModel;
    if (!reuse) await deleteDocuments(erpKey);

    // Marca como desatualizado enquanto atualiza: se for cancelado no meio, o índice não finge estar pronto
    // (os documentos já gravados continuam válidos e a próxima execução os reaproveita).
    const stub = {
      erpKey,
      embedModel,
      dimension: reuse ? meta.dimension : 0,
      builtAt: reuse ? meta.builtAt : new Date(),
      stale: true,
    };
    await setMeta(stub);

    const a = await syncKind(erpKey, "table", tables, reuse, progress, signal);
    const b = await syncKind(erpKey, "query", saved, reuse, progress, signal);
    const dimension = a.dimension || b.dimension || stub.dimension;
    await setMeta({ ...stub, dimension, builtAt: new Date(), stale: false });
    progress({
      type: "done",
      documents: tables.length + saved.length,
      embedded: a.embedded + b.embedded,
      embedMs: Math.round(a.embedMs + b.embedMs),
    });
  } finally {
    running.delete(erpKey);
  }
}

// Indexa, uma vez e sob demanda, as colunas de uma tabela já recuperada (cache na mesma tabela de vetores).
// Colunas cuja descrição mudou no dicionário (hash diferente) são recalculadas.
export async function ensureColumns(table: string, signal?: AbortSignal): Promise<void> {
  const erpKey = await erpKeyOfActiveProfile();
  const name = tableName(table);
  const columns = await listColumns(name);
  const have = await existingHashes(erpKey, "column", `${name}.`);
  const missing = columns
    .map((c) => columnDocument(name, c.name, c.description))
    .filter((doc) => have.get(doc.ref) !== documentHash(doc));
  await embedAndStore(erpKey, missing, () => {}, signal);
}
