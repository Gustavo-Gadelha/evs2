// Histórico e consultas salvas, persistidos no Postgres pelas rotas `/api/history` e `/api/saved`.

import { api } from "@/lib/api";
import type { QueryState } from "@/lib/sql/query-state";
import type { QueryResult } from "@/lib/types";

export type QueryDraft = { state: QueryState; sql: string; manual: boolean };

export type HistoryEntry = QueryDraft & {
  id: string;
  timestamp: string;
  // null quando a execução falhou.
  rowCount: number | null;
  error: string | null;
  // Guardado só quando pequeno o bastante (ver MAX_RESULT_BYTES).
  result?: QueryResult;
};

// A listagem não traz o resultado (pode ter MBs): `hasResult` avisa que `history.get` o devolve.
export type HistoryItem = Omit<HistoryEntry, "result"> & { hasResult: boolean };

export type SavedQuery = QueryDraft & { id: string; name: string; savedAt: string };

export type RunOutcome = { result: QueryResult } | { error: string };

export const MAX_HISTORY = 200;
export const MAX_RESULT_BYTES = 5 * 1024 * 1024;

const SAVED_KEY = "snk-assistant:v2:saved";

export function toDraft({ state, sql, manual }: QueryDraft): QueryDraft {
  return { state: structuredClone(state), sql, manual };
}

export const history = {
  list: () => api<HistoryItem[]>("/api/history"),

  get: (id: string) => api<HistoryEntry>(`/api/history/${encodeURIComponent(id)}`),

  // Devolve a lista atualizada (já sem as entradas além de MAX_HISTORY).
  add(draft: QueryDraft, outcome: RunOutcome) {
    const result = "result" in outcome ? outcome.result : undefined;
    const size = result ? new Blob([JSON.stringify(result)]).size : Infinity;
    return api<HistoryItem[]>("/api/history", {
      method: "POST",
      body: JSON.stringify({
        ...toDraft(draft),
        rowCount: result ? result.rows.length : null,
        error: "error" in outcome ? outcome.error : null,
        result: result && size <= MAX_RESULT_BYTES ? result : undefined,
      }),
    });
  },

  // Exclui uma entrada e devolve a lista atualizada.
  remove: (id: string) => api<HistoryItem[]>(`/api/history/${encodeURIComponent(id)}`, { method: "DELETE" }),

  clear: () => api<HistoryItem[]>("/api/history", { method: "DELETE" }),
};

export const savedQueries = {
  list: () => api<SavedQuery[]>("/api/saved"),

  save: (name: string, draft: QueryDraft) =>
    api<SavedQuery[]>("/api/saved", { method: "POST", body: JSON.stringify({ ...toDraft(draft), name }) }),

  remove: (id: string) => api<SavedQuery[]>(`/api/saved/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Consultas salvas no `localStorage` antes do banco: envia ao banco e limpa o storage.
  async importLegacy(): Promise<SavedQuery[] | null> {
    let legacy: SavedQuery[];
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "[]");
      legacy = Array.isArray(parsed) ? (parsed as SavedQuery[]) : [];
    } catch {
      return null;
    }
    if (legacy.length === 0) return null;

    let items: SavedQuery[] | null = null;
    // Do mais antigo ao mais novo, para a ordem por data se manter.
    for (const { name, state, sql, manual, savedAt } of [...legacy].reverse()) {
      items = await api<SavedQuery[]>("/api/saved", {
        method: "POST",
        body: JSON.stringify({ name, state, sql, manual, savedAt }),
      });
    }
    try {
      localStorage.removeItem(SAVED_KEY);
      localStorage.removeItem("snk-assistant:v2:history");
    } catch {
      // Storage indisponível: sem importar de novo só se a limpeza funcionar.
    }
    return items;
  },
};
