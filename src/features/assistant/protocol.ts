// Contrato do assistente, compartilhado entre a rota e o navegador (sem `server-only`).

export type ChatRole = "user" | "assistant";

// `steps`: etapas do agente da resposta em andamento (só no navegador; não vão ao servidor).
export type ChatMessage = { id: string; role: ChatRole; content: string; steps?: string[] };

// Corpo de `POST /api/assistant/chat`. O agente responde à última mensagem do usuário, usando o SQL atual da aba
// como contexto; `error` é a mensagem do Oracle quando o pedido é corrigir esse SQL ("Corrigir com IA").
export type ChatRequest = {
  messages: { role: ChatRole; content: string }[];
  sql: string;
  limitStyle?: "fetch" | "rownum";
  error?: string;
};

// A resposta é `application/x-ndjson`: um evento por linha. `step` é o andamento do agente; o SQL final e as
// tabelas usadas chegam num `delta` em Markdown, que o painel já sabe exibir.
export type ChatEvent =
  | { type: "step"; text: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
