import "server-only";

import { aiConfig } from "./config";
import { buildIndex, isIndexing } from "./indexer";
import { countDocuments, erpKeyOfActiveProfile, getMeta } from "./index-store";
import type { IndexEvent, IndexStatus } from "../index-protocol";
import { AiIndexBusyError } from "@/lib/ai/errors";
import { localOnly } from "@/features/sankhya/server/local-only";

export const GET = localOnly(async () => {
  const erpKey = await erpKeyOfActiveProfile();
  const [meta, documents] = await Promise.all([getMeta(erpKey), countDocuments(erpKey)]);
  const status: IndexStatus = {
    erpKey,
    built: !!meta && meta.dimension > 0,
    documents,
    embedModel: meta?.embedModel ?? null,
    dimension: meta?.dimension ?? null,
    builtAt: meta?.builtAt.toISOString() ?? null,
    stale: meta?.stale ?? false,
    modelMismatch: !!meta && meta.embedModel !== aiConfig().embedModel,
    building: isIndexing(erpKey),
  };
  return Response.json(status);
});

// Reconstrói o índice do perfil ativo, com o progresso em NDJSON. Cancelar a requisição interrompe a indexação.
export const POST = localOnly(async (req) => {
  // Falhas de pré-condição (sem perfil, indexação em andamento) saem como resposta de erro normal, antes do stream.
  const erpKey = await erpKeyOfActiveProfile();
  if (isIndexing(erpKey)) throw new AiIndexBusyError("Já existe uma indexação em andamento para este ERP.");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: IndexEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await buildIndex(send, req.signal);
      } catch (err) {
        if (!req.signal.aborted)
          send({ type: "error", message: err instanceof Error ? err.message : "Erro ao indexar." });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
