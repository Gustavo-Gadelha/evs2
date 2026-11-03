import "server-only";

import { aiConfig } from "./config";
import { AiTimeoutError, AiUnavailableError } from "@/lib/ai/errors";

// Embeddings pelo Ollama (`POST /api/embed`). O endereço vem da configuração do servidor, nunca do navegador.
export async function embed(inputs: string[], signal?: AbortSignal): Promise<number[][]> {
  const { ollamaBaseUrl, embedModel, timeoutMs } = aiConfig();
  const timeout = AbortSignal.timeout(timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${ollamaBaseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `num_gpu: 0` roda o modelo de embeddings na CPU: numa GPU de 8 GB ele e o de chat se expulsariam a cada
      // chamada (recarregar custa segundos). Textos curtos são baratos na CPU.
      body: JSON.stringify({ model: embedModel, input: inputs, options: { num_gpu: 0 } }),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (err) {
    if (timeout.aborted) throw new AiTimeoutError(`O Ollama não respondeu em ${timeoutMs} ms.`);
    if (signal?.aborted) throw err;
    throw new AiUnavailableError(
      `Ollama indisponível em ${ollamaBaseUrl}. Suba o serviço (docker compose up -d ollama).`,
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 404) {
      throw new AiUnavailableError(`Modelo "${embedModel}" não baixado. Rode: ollama pull ${embedModel}`);
    }
    throw new AiUnavailableError(
      `O Ollama recusou a requisição de embeddings (${res.status}). ${detail.slice(0, 200)}`,
    );
  }

  const body = (await res.json()) as { embeddings?: number[][] };
  if (!body.embeddings || body.embeddings.length !== inputs.length) {
    throw new AiUnavailableError("Resposta de embeddings inesperada do Ollama.");
  }
  return body.embeddings;
}

// Falha cedo, com a mensagem certa, se o Ollama estiver fora do ar ou faltar um modelo (antes de abrir o stream).
export async function assertOllamaReady(models: string[]): Promise<void> {
  const { ollamaBaseUrl } = aiConfig();
  let installed: string[];
  try {
    const res = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(String(res.status));
    installed = ((await res.json()) as { models?: { name: string }[] }).models?.map((m) => m.name) ?? [];
  } catch {
    throw new AiUnavailableError(
      `Ollama indisponível em ${ollamaBaseUrl}. Suba o serviço (docker compose up -d ollama).`,
    );
  }
  for (const model of models) {
    if (!installed.includes(model) && !installed.includes(`${model}:latest`)) {
      throw new AiUnavailableError(`Modelo "${model}" não baixado. Rode: ollama pull ${model}`);
    }
  }
}
