import "server-only";

import { tool } from "ai";
import { z } from "zod";

import { searchColumns, searchTables } from "./search";
import { InvalidTableError, tableName } from "@/features/dictionary/server/dictionary";

export type AgentTrace = {
  // Tabelas que o modelo pode citar: as recuperadas e as que ele detalhou com listarColunas.
  knownTables: Set<string>;
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
  };
}
