import "server-only";

import { aiConfig } from "./config";
import { localOnly } from "@/features/sankhya/server/local-only";

// Modelos de `ollama pull` aparecem com tag (`bge-m3:latest`); `qwen3:8b` já a traz.
const hasModel = (installed: string[], model: string) =>
  installed.includes(model) || installed.includes(`${model}:latest`);

export const GET = localOnly(async () => {
  const config = aiConfig();
  let ollama: { reachable: boolean; chatModelReady: boolean; embedModelReady: boolean };
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    const body = (await res.json()) as { models?: { name: string }[] };
    const installed = (body.models ?? []).map((m) => m.name);
    ollama = {
      reachable: res.ok,
      chatModelReady: hasModel(installed, config.chatModel),
      embedModelReady: hasModel(installed, config.embedModel),
    };
  } catch {
    ollama = { reachable: false, chatModelReady: false, embedModelReady: false };
  }
  return Response.json({ ...config, ollama });
});
