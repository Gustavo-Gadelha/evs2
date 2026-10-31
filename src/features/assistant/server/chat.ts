import "server-only";

import { z } from "zod";

import type { ChatEvent } from "../protocol";
import { localOnly } from "@/features/sankhya/server/local-only";

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) }))
    .min(1)
    .max(100),
  sql: z.string().max(100_000),
});

// Resposta simulada, até a integração com o Ollama. Os pedaços imitam o streaming do modelo.
const STUB_REPLY = [
  "(Resposta simulada: o Ollama ainda não está ligado.) ",
  "Este é um exemplo de consulta:\n\n",
  "```sql\n",
  "SELECT NUNOTA, CODPARC, VLRNOTA\n",
  "FROM TGFCAB\n",
  "ORDER BY NUNOTA DESC\n",
  "FETCH FIRST 10 ROWS ONLY\n",
  "```\n\n",
  "Revise o SQL antes de usar.",
];

const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

export const POST = localOnly(async (req) => {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: { type: "InvalidRequest", message: z.prettifyError(parsed.error) } },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      for (const text of STUB_REPLY) {
        if (req.signal.aborted) break;
        send({ type: "delta", text });
        await delay(150, req.signal);
      }
      if (!req.signal.aborted) send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
});
