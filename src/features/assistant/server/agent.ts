import "server-only";

import { generateText, isStepCount, type ModelMessage } from "ai";

import type { AiProvider } from "../protocol";
import { aiConfig } from "./config";
import { chatModel } from "./model";
import { searchTables } from "./search";
import { agentTools, validateOnOracle, type AgentTrace } from "./tools";
import { AiTimeoutError, AiUnavailableError } from "@/lib/ai/errors";
import { buildRetryPrompt, buildSystemPrompt, buildUserPrompt, type LimitStyle } from "@/lib/ai/prompt";
import { cleanSql, extractSql, stripThinking } from "@/lib/ai/sql-extract";
import { log, redactText } from "@/features/sankhya/server/redact";

export type AgentInput = {
  question: string;
  sql?: string;
  error?: string;
  limitStyle: LimitStyle;
  provider: AiProvider;
  signal: AbortSignal;
  // Etapas legíveis para a interface (para a espera na CPU parecer andamento e não travamento).
  onStep: (text: string) => void;
};

export type AgentResult = {
  // SQL final, ou null se o modelo respondeu só com texto (por exemplo, ao explicar um SQL).
  sql: string | null;
  text: string;
  tables: string[];
  attempts: number;
  valid: boolean;
  validationError: string | null;
  metrics: { ms: number; embedMs: number; steps: number; inputTokens: number; outputTokens: number };
};

function mapError(err: unknown, timeout: AbortSignal, userSignal: AbortSignal, provider: AiProvider): unknown {
  if (userSignal.aborted) return err;
  const { timeoutMs, ollamaBaseUrl, chatModel: model } = aiConfig();
  if (timeout.aborted) return new AiTimeoutError(`A IA não terminou em ${timeoutMs} ms.`);
  const text = `${err instanceof Error ? err.message : ""} ${(err as { cause?: { code?: string } })?.cause?.code ?? ""}`;
  if (provider === "google") {
    if (/API key|401|403|PERMISSION_DENIED|UNAUTHENTICATED/i.test(text)) {
      return new AiUnavailableError("Google recusou a chave (GOOGLE_GENERATIVE_AI_API_KEY inválida ou sem permissão).");
    }
    if (/429|quota|RESOURCE_EXHAUSTED|rate limit/i.test(text)) {
      return new AiUnavailableError("Cota ou limite de requisições do Google esgotado. Tente de novo em instantes.");
    }
    if (/ECONNREFUSED|fetch failed|ENOTFOUND|Cannot connect/i.test(text)) {
      return new AiUnavailableError("Não consegui acessar a API do Google. Verifique a conexão.");
    }
    return err;
  }
  if (/ECONNREFUSED|fetch failed|ENOTFOUND|Cannot connect/i.test(text)) {
    return new AiUnavailableError(
      `Ollama indisponível em ${ollamaBaseUrl}. Suba o serviço (docker compose up -d ollama).`,
    );
  }
  if (/not found|404/i.test(text)) {
    return new AiUnavailableError(`Modelo "${model}" não baixado. Rode: ollama pull ${model}`);
  }
  return err;
}

// Tabelas do SQL que o agente conhece (recuperadas ou detalhadas), na ordem em que aparecem.
function usedTables(sql: string, known: Set<string>): string[] {
  const words = sql.toUpperCase().match(/[A-Z_][A-Z0-9_$#]*/g) ?? [];
  return [...new Set(words.filter((w) => known.has(w)))];
}

export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const config = aiConfig();
  const started = performance.now();
  const timeout = AbortSignal.timeout(config.timeoutMs);
  const signal = AbortSignal.any([input.signal, timeout]);

  const trace: AgentTrace = { knownTables: new Set(), validated: new Map(), lastSql: null, emit: input.onStep };
  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    input.onStep("Buscando tabelas no dicionário");
    const retrieval = await searchTables(input.question, signal);
    retrieval.tables.forEach((t) => trace.knownTables.add(t.ref));
    input.onStep(
      `Tabelas candidatas: ${retrieval.tables.map((t) => t.ref).join(", ") || "nenhuma"} (embedding ${retrieval.embedMs} ms)`,
    );

    const { model, providerOptions } = chatModel(input.provider);
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: buildUserPrompt({
          question: input.question,
          tables: retrieval.tables.map((t) => ({ name: t.ref, description: t.content })),
          examples: retrieval.examples.map((e) => ({ name: e.title, sql: e.content })),
          sql: input.sql,
          error: input.error,
        }),
      },
    ];
    const tools = agentTools(input.question, trace, signal);

    let sql: string | null = null;
    let text = "";
    let validationError: string | null = null;
    let attempts = 0;

    for (let attempt = 0; attempt <= config.maxFixAttempts; attempt++) {
      attempts = attempt + 1;
      trace.lastSql = null;
      input.onStep(attempt === 0 ? "Gerando o SQL" : `Tentativa ${attempts}: corrigindo o SQL`);

      const result = await generateText({
        model,
        system: buildSystemPrompt(input.limitStyle),
        messages,
        tools,
        stopWhen: isStepCount(config.maxSteps),
        // O último passo não oferece ferramentas (o Ollama não respeita `toolChoice: none`): sem texto final não haveria resposta.
        prepareStep: ({ stepNumber }) => (stepNumber >= config.maxSteps - 1 ? { activeTools: [] } : {}),
        abortSignal: signal,
        temperature: 0,
        providerOptions,
      });
      steps += result.steps.length;
      inputTokens += result.totalUsage.inputTokens ?? 0;
      outputTokens += result.totalUsage.outputTokens ?? 0;

      text = stripThinking(result.text).trim();
      sql = extractSql(text);
      // Resposta final em prosa depois de tentar validar um SQL: o SQL em ajuste é o que vale.
      if (!sql && trace.lastSql) {
        sql = trace.lastSql;
        text = `\`\`\`sql
${sql}
\`\`\``;
      }
      // Sem ferramentas no último passo, o modelo às vezes despeja a chamada como texto: não é resposta.
      if (!sql && /<tool_call>/i.test(text)) {
        text = "";
        validationError = "A resposta não trouxe o SQL.";
        messages.push(
          { role: "assistant", content: "(sem resposta)" },
          { role: "user", content: buildRetryPrompt(validationError) },
        );
        input.onStep("A resposta não trouxe o SQL");
        continue;
      }
      // Sem SQL: resposta em texto (explicação, por exemplo). Não há o que validar nem corrigir.
      if (!sql) {
        validationError = null;
        break;
      }

      input.onStep("Validando o SQL final");
      const known = trace.validated.get(cleanSql(sql));
      validationError = known !== undefined ? known : await validateOnOracle(sql);
      if (validationError === null) break;
      input.onStep(`O Oracle recusou: ${redactText(validationError).slice(0, 160)}`);

      messages.push({ role: "assistant", content: text }, { role: "user", content: buildRetryPrompt(validationError) });
    }

    const metrics = {
      ms: Math.round(performance.now() - started),
      embedMs: retrieval.embedMs,
      steps,
      inputTokens,
      outputTokens,
    };
    log.info(
      `[assistant] preset=${config.preset} provider=${input.provider} model=${input.provider === "google" ? config.googleChatModel : config.chatModel} steps=${steps} attempts=${attempts} ` +
        `valid=${sql ? validationError === null : "n/a"} in=${inputTokens} out=${outputTokens} ms=${metrics.ms}`,
    );

    return {
      sql,
      text,
      tables: sql ? usedTables(sql, trace.knownTables) : [],
      attempts,
      valid: sql ? validationError === null : false,
      validationError: sql ? validationError : null,
      metrics,
    };
  } catch (err) {
    throw mapError(err, timeout, input.signal, input.provider);
  }
}
