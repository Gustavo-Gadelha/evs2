import "server-only";

import { searchTables } from "./search";
import { localOnly } from "@/features/sankhya/server/local-only";

// Depuração da recuperação: tabelas, scores e tempos para uma pergunta (GET ?q=). Não chama o modelo de chat.
export const GET = localOnly(async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > 2000) {
    return Response.json(
      { error: { type: "InvalidRequest", message: "Informe q (até 2000 caracteres)." } },
      { status: 400 },
    );
  }
  const { tables, examples, embedMs, searchMs } = await searchTables(q, req.signal);
  return Response.json({
    question: q,
    embedMs,
    searchMs,
    tables: tables.map(({ ref, title, content, score, sources }) => ({
      name: ref,
      description: content || title,
      score,
      sources,
    })),
    examples: examples.map(({ title, score }) => ({ name: title, score })),
  });
});
