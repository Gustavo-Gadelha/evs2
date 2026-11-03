import "server-only";

import { aiConfig } from "./config";
import { erpKeyOfActiveProfile, requireUsableIndex, textSearch, vectorSearch, type Hit } from "./index-store";
import { ensureColumns } from "./indexer";
import { embed } from "./ollama";
import { toTsQuery } from "@/lib/ai/documents";
import { reciprocalRankFusion } from "@/lib/ai/fusion";
import { tableName } from "@/features/dictionary/server/dictionary";

// Cada ranking traz mais candidatos que o pedido: a fusão reordena e só então corta.
const POOL = 3;

export type Ranked = Hit & { sources: ("vector" | "text")[] };

// Busca híbrida: vetor (significado) + texto (nomes como TGFCAB, que não carregam sentido para embeddings),
// unidos por reciprocal rank fusion.
async function hybrid(
  erpKey: string,
  filter: Parameters<typeof vectorSearch>[1],
  question: string,
  queryVector: number[],
  limit: number,
): Promise<Ranked[]> {
  const [byVector, byText] = await Promise.all([
    vectorSearch(erpKey, filter, queryVector, limit * POOL),
    textSearch(erpKey, filter, toTsQuery(question), limit * POOL),
  ]);
  const hits = new Map<string, Ranked>();
  const track = (list: Hit[], source: "vector" | "text") =>
    list.forEach((hit) => {
      const known = hits.get(hit.ref);
      if (known) known.sources.push(source);
      else hits.set(hit.ref, { ...hit, sources: [source] });
    });
  track(byVector, "vector");
  track(byText, "text");

  return reciprocalRankFusion([byVector.map((h) => h.ref), byText.map((h) => h.ref)])
    .slice(0, limit)
    .map(({ id, score }) => ({ ...hits.get(id)!, score }));
}

async function embedQuestion(question: string, signal?: AbortSignal) {
  const started = performance.now();
  const [vector] = await embed([question], signal);
  return { vector, embedMs: Math.round(performance.now() - started) };
}

// Tabelas candidatas para a pergunta (até `AI_TOP_TABLES`) e as consultas salvas mais parecidas (1–2, como exemplos).
export async function searchTables(question: string, signal?: AbortSignal) {
  const erpKey = await erpKeyOfActiveProfile();
  await requireUsableIndex(erpKey);
  const { topTables } = aiConfig();

  const { vector, embedMs } = await embedQuestion(question, signal);
  const started = performance.now();
  const [tables, examples] = await Promise.all([
    hybrid(erpKey, { kinds: ["table"] }, question, vector, topTables),
    vectorSearch(erpKey, { kinds: ["query"] }, vector, 2),
  ]);
  return { tables, examples, embedMs, searchMs: Math.round(performance.now() - started) };
}

// Colunas de uma tabela já recuperada, ordenadas por relevância à pergunta (até `AI_MAX_COLUMNS_PER_TABLE`).
export async function searchColumns(table: string, question: string, signal?: AbortSignal) {
  const erpKey = await erpKeyOfActiveProfile();
  await requireUsableIndex(erpKey);
  const name = tableName(table);
  await ensureColumns(name, signal);

  const { maxColumnsPerTable } = aiConfig();
  const { vector } = await embedQuestion(question, signal);
  return hybrid(erpKey, { kinds: ["column"], refPrefix: `${name}.` }, question, vector, maxColumnsPerTable);
}
