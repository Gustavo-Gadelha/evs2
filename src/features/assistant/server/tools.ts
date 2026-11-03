import "server-only";

import { tool } from "ai";
import { z } from "zod";

import { searchColumns, searchTables } from "./search";
import { checkReadOnly } from "@/lib/sql/read-only";
import { cleanSql } from "@/lib/ai/sql-extract";
import { wrapForValidation } from "@/lib/ai/validate";
import { executeQuery } from "@/features/query/server/execute";
import { SankhyaQueryError } from "@/features/sankhya/server/errors";
import { redactText } from "@/features/sankhya/server/redact";
import { InvalidTableError, tableName } from "@/features/dictionary/server/dictionary";

// Valida o SQL no Oracle sem trazer dados: trava de leitura e, se passar, a consulta embrulhada com
// `ROWNUM <= 0` (ver `wrapForValidation`). Devolve só `null` (ok) ou a mensagem do Oracle: nenhuma linha do ERP
// chega ao modelo, aos logs ou à resposta.
export async function validateOnOracle(sql: string): Promise<string | null> {
  const clean = cleanSql(sql);
  const inner = checkReadOnly(clean);
  if (!inner.ok) return inner.reason;
  const wrapped = wrapForValidation(clean);
  const outer = checkReadOnly(wrapped);
  if (!outer.ok) return outer.reason;
  try {
    await executeQuery(wrapped);
    return null;
  } catch (err) {
    if (err instanceof SankhyaQueryError) return redactText(err.message);
    throw err;
  }
}

export type AgentTrace = {
  // Tabelas que o modelo pode citar: as recuperadas e as que ele detalhou com listarColunas.
  knownTables: Set<string>;
  // Resultado de validarSQL por SQL, para não repetir a ida ao Oracle na validação final.
  validated: Map<string, string | null>;
  // Último SQL enviado a validarSQL na rodada: se a resposta final vier sem SQL, é o que o modelo estava ajustando.
  lastSql: string | null;
  emit: (text: string) => void;
};

export function agentTools(question: string, trace: AgentTrace, signal: AbortSignal) {
  return {
    buscarTabelas: tool({
      description: "Busca tabelas do dicionário do Sankhya relacionadas a um assunto. Devolve nome e descrição.",
      inputSchema: z.object({ consulta: z.string().min(1).max(300).describe("Assunto ou nomes de tabela") }),
      execute: async ({ consulta }) => {
        trace.emit(`Buscando tabelas: "${consulta}"`);
        const { tables } = await searchTables(consulta, signal);
        tables.forEach((t) => trace.knownTables.add(t.ref));
        return tables.map((t) => ({ tabela: t.ref, descricao: t.content }));
      },
    }),
    listarColunas: tool({
      description:
        "Lista as colunas mais relevantes de até 4 tabelas de uma vez (nome e descrição). Chame uma única vez com todas as tabelas que pretende usar.",
      inputSchema: z.object({ tabelas: z.array(z.string().min(1).max(60)).min(1).max(4) }),
      execute: async ({ tabelas }) => {
        const result: Record<string, { coluna: string; descricao: string }[] | { erro: string }> = {};
        for (const tabela of tabelas) {
          let name: string;
          try {
            name = tableName(tabela);
          } catch (err) {
            if (err instanceof InvalidTableError) {
              result[tabela] = { erro: err.message };
              continue;
            }
            throw err;
          }
          trace.emit(`Lendo colunas de ${name}`);
          const columns = await searchColumns(name, question, signal);
          if (columns.length === 0) {
            result[name] = { erro: `Tabela ${name} não encontrada no dicionário.` };
            continue;
          }
          trace.knownTables.add(name);
          result[name] = columns.map((c) => ({ coluna: c.ref.slice(name.length + 1), descricao: c.content }));
        }
        return result;
      },
    }),
    validarSQL: tool({
      description: "Valida o SQL no Oracle (sintaxe, tabelas e colunas). Devolve ok ou a mensagem de erro do Oracle.",
      inputSchema: z.object({ sql: z.string().min(1).max(20_000) }),
      execute: async ({ sql }) => {
        trace.emit("Validando o SQL no Oracle");
        const error = await validateOnOracle(sql);
        trace.lastSql = cleanSql(sql);
        trace.validated.set(cleanSql(sql), error);
        if (error !== null) trace.emit(`O Oracle recusou: ${redactText(error).slice(0, 160)}`);
        return error === null ? { resultado: "ok" } : { resultado: "erro", mensagem: error };
      },
    }),
  };
}
