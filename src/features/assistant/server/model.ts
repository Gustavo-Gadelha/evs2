import "server-only";

import { createOllama } from "ollama-ai-provider-v2";

import { aiConfig } from "./config";

// Provider nativo do Ollama (não o `/v1` OpenAI-compatível): só ele repassa `think` e `options.num_ctx`,
// que o preset `cpu` precisa (raciocínio do Qwen3 desligado e contexto menor).
export function chatModel() {
  const config = aiConfig();
  const ollama = createOllama({ baseURL: `${config.ollamaBaseUrl}/api` });
  return {
    model: ollama(config.chatModel),
    providerOptions: { ollama: { think: config.think, options: { num_ctx: config.numCtx } } },
  };
}
