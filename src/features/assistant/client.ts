import type { ApiError } from "@/lib/types";
import type { ChatEvent, ChatRequest } from "./protocol";

// Lê a resposta NDJSON de /api/assistant/chat. Chama `onDelta` a cada pedaço de texto e `onStep` a cada etapa do
// agente; lança `Error` em falha.
export async function streamChat(
  body: ChatRequest,
  signal: AbortSignal,
  onDelta: (text: string) => void,
  onStep?: (text: string) => void,
) {
  const response = await fetch("/api/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const data = (await response.json().catch(() => null)) as ApiError | null;
    throw new Error(data?.error?.message ?? `${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function handle(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ChatEvent;
    if (event.type === "delta") onDelta(event.text);
    else if (event.type === "step") onStep?.(event.text);
    else if (event.type === "error") throw new Error(event.message);
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(handle);
  }
  handle(buffer);
}
