// Eventos do POST /api/assistant/index (NDJSON) e resposta do GET.
export type IndexEvent =
  | { type: "progress"; phase: "tables" | "queries"; done: number; total: number }
  | { type: "done"; documents: number; embedMs: number }
  | { type: "error"; message: string };

export type IndexStatus = {
  erpKey: string;
  built: boolean;
  documents: { table: number; column: number; query: number };
  embedModel: string | null;
  dimension: number | null;
  builtAt: string | null;
  stale: boolean;
  // O índice existe mas foi gerado com outro modelo que o configurado.
  modelMismatch: boolean;
  building: boolean;
};
