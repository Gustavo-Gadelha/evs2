// Tipos compartilhados entre o navegador e as rotas `/api/sankhya/*`.

export type QueryResult = {
  columns: string[];
  rows: unknown[][];
  durationMs: number;
  // Corpo original do gateway, para a visão JSON.
  raw: unknown;
};

export type ApiError = { error: { type: string; message: string } };

export type AuthStatus = {
  authenticated: boolean;
  authenticatedAt: string | null;
  // null quando não há perfil ativo.
  baseUrl: string | null;
  profile: { id: string; name: string } | null;
};

export type DictionaryEntry = { name: string; description: string };
