// Eventos do POST /api/assistant/index (NDJSON) e resposta do GET.
export type IndexEvent =
  | { type: "progress"; phase: "tables" | "queries"; done: number; total: number }
  // `embedded`: quantos documentos foram (re)calculados; o resto foi reaproveitado do índice anterior.
  | { type: "done"; documents: number; embedded: number; embedMs: number }
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
