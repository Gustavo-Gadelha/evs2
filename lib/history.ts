// Histórico e consultas salvas no `localStorage` do navegador. Toda leitura e escrita tolera
// storage indisponível ou cheio: a página funciona igual, só sem persistir.

import type { QueryState } from "./sql/query-state";
import type { QueryResult } from "./types";

export type QueryDraft = { state: QueryState; sql: string; manual: boolean };

export type HistoryEntry = QueryDraft & {
  id: string;
  timestamp: string;
  // null quando a execução falhou.
  rowCount: number | null;
  error: string | null;
  // Guardado só quando pequeno o bastante (ver MAX_STORED_RESULT_BYTES).
  result?: QueryResult;
};

export type SavedQuery = QueryDraft & { id: string; name: string; savedAt: string };

export type RunOutcome = { result: QueryResult } | { error: string };

// v2: formato do builder SQL; entradas do explorador de API antigo ficam para trás.
const HISTORY_KEY = "snk-assistant:v2:history";
const SAVED_KEY = "snk-assistant:v2:saved";
const MAX_HISTORY = 50;
const MAX_STORED_RESULT_BYTES = 200 * 1024;

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    // Storage indisponível ou cheio.
    return false;
  }
}

export function toDraft({ state, sql, manual }: QueryDraft): QueryDraft {
  return { state: structuredClone(state), sql, manual };
}

function newId(): string {
  return crypto.randomUUID();
}

export const history = {
  list: () => read<HistoryEntry>(HISTORY_KEY),

  add(draft: QueryDraft, outcome: RunOutcome): HistoryEntry[] {
    const result = "result" in outcome ? outcome.result : undefined;
    const size = result ? new Blob([JSON.stringify(result)]).size : Infinity;
    const entry: HistoryEntry = {
      ...toDraft(draft),
      id: newId(),
      timestamp: new Date().toISOString(),
      rowCount: result ? result.rows.length : null,
      error: "error" in outcome ? outcome.error : null,
      result: result && size <= MAX_STORED_RESULT_BYTES ? result : undefined,
    };
    const items = [entry, ...read<HistoryEntry>(HISTORY_KEY)].slice(0, MAX_HISTORY);
    if (!write(HISTORY_KEY, items)) {
      // Cota do storage estourada: mantém o resultado só na entrada mais recente.
      write(HISTORY_KEY, items.map((item, index) => (index === 0 ? item : { ...item, result: undefined })));
    }
    return items;
  },

  clear(): HistoryEntry[] {
    write(HISTORY_KEY, []);
    return [];
  },
};

export const savedQueries = {
  list: () => read<SavedQuery>(SAVED_KEY),

  save(name: string, draft: QueryDraft): SavedQuery[] {
    const items = [{ ...toDraft(draft), id: newId(), name, savedAt: new Date().toISOString() }, ...read<SavedQuery>(SAVED_KEY)];
    write(SAVED_KEY, items);
    return items;
  },

  remove(id: string): SavedQuery[] {
    const items = read<SavedQuery>(SAVED_KEY).filter((item) => item.id !== id);
    write(SAVED_KEY, items);
    return items;
  },
};
