// Contrato do assistente, compartilhado entre a rota e o navegador (sem `server-only`).

export type ChatRole = "user" | "assistant";

export type ChatMessage = { id: string; role: ChatRole; content: string };

// Corpo de `POST /api/assistant/chat`: a conversa e o SQL atual da aba, como contexto.
export type ChatRequest = {
  messages: { role: ChatRole; content: string }[];
  sql: string;
};

// A resposta é `application/x-ndjson`: um evento por linha.
export type ChatEvent = { type: "delta"; text: string } | { type: "done" } | { type: "error"; message: string };
