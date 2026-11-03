import "server-only";

import { z } from "zod";

// Padrões de cada preset; qualquer variável AI_* preenchida os sobrescreve. O que muda entre o desktop (GPU)
// e o notebook (só CPU) fica aqui e no .env, nunca no código das rotas.
const PRESETS = {
  gpu: {
    chatModel: "qwen3:8b",
    think: false,
    embedModel: "bge-m3",
    numCtx: 8192,
    topTables: 8,
    maxColumnsPerTable: 40,
    maxSteps: 6,
    maxFixAttempts: 2,
    timeoutMs: 60_000,
  },
  cpu: {
    chatModel: "qwen3:4b",
    think: false,
    embedModel: "bge-m3",
    numCtx: 4096,
    topTables: 4,
    maxColumnsPerTable: 20,
    maxSteps: 4,
    maxFixAttempts: 1,
    timeoutMs: 240_000,
  },
} as const;

// O compose repassa as variáveis não definidas como string vazia: trate "" como ausente.
const blank = (v: unknown) => (v === "" ? undefined : v);
const text = z.preprocess(blank, z.string().trim().min(1).optional());
const int = z.preprocess(blank, z.coerce.number().int().positive().optional());
// Para contagens em que 0 é válido (AI_MAX_FIX_ATTEMPTS=0: sem tentativa de correção automática).
const nonNegativeInt = z.preprocess(blank, z.coerce.number().int().nonnegative().optional());
const bool =z.preprocess(blank, z.enum(["true", "false"]).optional());

const envSchema = z.object({
  AI_PRESET: z.preprocess(blank, z.enum(["gpu", "cpu"]).default("gpu")),
  OLLAMA_BASE_URL: z.preprocess(blank, z.url().default("http://127.0.0.1:11434")),
  AI_CHAT_MODEL: text,
  AI_THINK: bool,
  AI_EMBED_MODEL: text,
  AI_NUM_CTX: int,
  AI_TOP_TABLES: int,
  AI_MAX_COLUMNS_PER_TABLE: int,
  AI_MAX_STEPS: int,
  AI_MAX_FIX_ATTEMPTS: nonNegativeInt,
  AI_TIMEOUT_MS: int,
});

export type AiConfig = {
  preset: keyof typeof PRESETS;
  ollamaBaseUrl: string;
  chatModel: string;
  think: boolean;
  embedModel: string;
  numCtx: number;
  topTables: number;
  maxColumnsPerTable: number;
  maxSteps: number;
  maxFixAttempts: number;
  timeoutMs: number;
};

export function aiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) throw new Error(`Configuração de IA inválida: ${z.prettifyError(parsed.error)}`);
  const e = parsed.data;
  const p = PRESETS[e.AI_PRESET];
  return {
    preset: e.AI_PRESET,
    ollamaBaseUrl: e.OLLAMA_BASE_URL.replace(/\/+$/, ""),
    chatModel: e.AI_CHAT_MODEL ?? p.chatModel,
    think: e.AI_THINK ? e.AI_THINK === "true" : p.think,
    embedModel: e.AI_EMBED_MODEL ?? p.embedModel,
    numCtx: e.AI_NUM_CTX ?? p.numCtx,
    topTables: e.AI_TOP_TABLES ?? p.topTables,
    maxColumnsPerTable: e.AI_MAX_COLUMNS_PER_TABLE ?? p.maxColumnsPerTable,
    maxSteps: e.AI_MAX_STEPS ?? p.maxSteps,
    maxFixAttempts: e.AI_MAX_FIX_ATTEMPTS ?? p.maxFixAttempts,
    timeoutMs: e.AI_TIMEOUT_MS ?? p.timeoutMs,
  };
}
