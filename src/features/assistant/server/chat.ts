import "server-only";

import { z } from "zod";

import { runAgent } from "./agent";
import { aiConfig } from "./config";
import { erpKeyOfActiveProfile, requireUsableIndex } from "./index-store";
import { assertOllamaReady } from "./ollama";
import type { ChatEvent } from "../protocol";
import { localOnly } from "@/features/sankhya/server/local-only";
import { redactText } from "@/features/sankhya/server/redact";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) }))
    .min(1)
    .max(100),
  sql: z.string().max(100_000),
  limitStyle: z.enum(["fetch", "rownum"]).default("fetch"),
  error: z.string().max(5_000).optional(),
});

// Pergunta de até ~2 KB: o resto da conversa fica só na tela (cada token a mais custa na CPU).
const MAX_QUESTION = 2_000;

function seconds(ms: number) {
  return (ms / 1000).toFixed(1).replace(".", ",");
}

export const POST = localOnly(async (req) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { type: "InvalidRequest", message: z.prettifyError(parsed.error) } },
      { status: 400 },
    );
  }
  const { messages, sql, limitStyle, error } = parsed.data;
  const question =
    [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.content.trim() ?? "";
  if (!question || question.length > MAX_QUESTION) {
    return Response.json(
      { error: { type: "InvalidRequest", message: `A pergunta deve ter de 1 a ${MAX_QUESTION} caracteres.` } },
      { status: 400 },
    );
  }

  // Falhas de pré-condição saem como resposta de erro tipada (503/409), antes de abrir o stream.
  const config = aiConfig();
  await requireUsableIndex(await erpKeyOfActiveProfile());
  await assertOllamaReady([config.chatModel, config.embedModel]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        if (!req.signal.aborted) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        const result = await runAgent({
          question,
          sql,
          error,
          limitStyle,
          signal: req.signal,
          onStep: (text) => send({ type: "step", text }),
        });

        let reply: string;
        if (result.sql) {
          const meta = [
            result.tables.length ? `Tabelas usadas: ${result.tables.join(", ")}` : null,
            `${result.attempts} tentativa(s)`,
            `${seconds(result.metrics.ms)} s`,
          ].filter(Boolean);
          reply = `\`\`\`sql\n${result.sql}\n\`\`\`\n\n${meta.join(" · ")}`;
          if (!result.valid) {
            const reason = redactText(result.validationError ?? "erro desconhecido");
            reply += `\n\n⚠ O Oracle não aceitou este SQL: ${reason}\nRevise antes de rodar.`;
          }
        } else {
          reply = result.text || "Não consegui gerar uma resposta. Tente reformular a pergunta.";
        }
        send({ type: "delta", text: reply });
        send({ type: "done" });
      } catch (err) {
        if (!req.signal.aborted) {
          send({ type: "error", message: err instanceof Error ? redactText(err.message) : "Erro no assistente." });
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
