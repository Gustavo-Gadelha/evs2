// Contrato do assistente, compartilhado entre a rota e o navegador (sem `server-only`).

// Provedor do modelo de chat; só este enum viaja do navegador (modelo e chave são resolvidos no servidor).
export const AI_PROVIDERS = ["ollama", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type ChatRole = "user" | "assistant";

// `steps` (etapas do agente) e `interrupted` (resposta parada pelo usuário) existem só no navegador; não vão ao servidor.
export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  steps?: string[];
  interrupted?: boolean;
};

// Corpo de `POST /api/assistant/chat`. O agente responde à última mensagem do usuário, usando o SQL atual da aba
// como contexto; `error` é a mensagem do Oracle quando o pedido é corrigir esse SQL ("Corrigir com IA").
export type ChatRequest = {
  messages: { role: ChatRole; content: string }[];
  sql: string;
  limitStyle?: "fetch" | "rownum";
  error?: string;
  provider?: AiProvider;
};

// A resposta é `application/x-ndjson`: um evento por linha. `step` é o andamento do agente; o SQL final e as
// tabelas usadas chegam num `delta` em Markdown, que o painel já sabe exibir.
export type ChatEvent =
  | { type: "step"; text: string }
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };
