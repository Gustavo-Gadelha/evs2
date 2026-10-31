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

export type ColumnOption = { value: string; label: string };

// Coluna do dicionário (TDDCAM) com o tipo, o tamanho e os valores de domínio (TDDOPC), quando houver.
export type ColumnInfo = {
  name: string;
  description: string;
  type: string;
  size: number | null;
  options: ColumnOption[];
};

// Ligação do dicionário (TDDLIG/TDDLGC) entre a tabela consultada e `table`; `pairs` casa colunas das duas.
export type Relation = {
  table: string;
  pairs: { column: string; otherColumn: string }[];
};

export type TableDetail = { columns: ColumnInfo[]; relations: Relation[] };
