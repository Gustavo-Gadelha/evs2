import "server-only";

import type { LanguageModel } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOllama } from "ollama-ai-provider-v2";

import type { AiProvider } from "../protocol";
import { AiUnavailableError } from "@/lib/ai/errors";
import { aiConfig } from "./config";

// Ollama: provider nativo (não o `/v1` OpenAI-compatível): só ele repassa `think` e `options.num_ctx`,
// que o preset `cpu` precisa (raciocínio do Qwen3 desligado e contexto menor).
// Google: opt-in; a chave é lida só aqui, no servidor, e o modelo vem de `AI_GOOGLE_CHAT_MODEL`.
export function chatModel(provider: AiProvider = "ollama"): {
  model: LanguageModel;
  providerOptions?: Record<string, Record<string, string | number | boolean | Record<string, number>>>;
} {
  const config = aiConfig();
  if (provider === "google") {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      throw new AiUnavailableError("Chave do Google não configurada. Defina GOOGLE_GENERATIVE_AI_API_KEY no .env.");
    }
    const google = createGoogleGenerativeAI({ apiKey });
    return { model: google(config.googleChatModel), providerOptions: undefined };
  }
  const ollama = createOllama({ baseURL: `${config.ollamaBaseUrl}/api` });
  return {
    model: ollama(config.chatModel),
    providerOptions: { ollama: { think: config.think, options: { num_ctx: config.numCtx } } },
  };
}
