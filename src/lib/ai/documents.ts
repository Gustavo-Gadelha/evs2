export type DocKind = "table" | "column" | "query";

export type IndexDocument = { kind: DocKind; ref: string; title: string; content: string; embedText: string };

const MAX_SQL_CHARS = 1500;

// O índice pertence ao ERP, não ao perfil: perfis diferem entre as máquinas, a base URL não.
export function normalizeBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl.trim());
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return baseUrl.trim().replace(/\/+$/, "").toLowerCase();
  }
}

export function tableDocument(name: string, description: string): IndexDocument {
  return { kind: "table", ref: name, title: name, content: description, embedText: `${name}: ${description}` };
}

export function columnDocument(table: string, column: string, description: string): IndexDocument {
  const ref = `${table}.${column}`;
  return { kind: "column", ref, title: ref, content: description, embedText: `${ref}: ${description}` };
}

// Consulta salva como exemplo (few-shot): nome + SQL.
export function queryDocument(id: string, name: string, sql: string): IndexDocument {
  const body = sql.length > MAX_SQL_CHARS ? sql.slice(0, MAX_SQL_CHARS) : sql;
  return { kind: "query", ref: id, title: name, content: body, embedText: `${name}\n${body}` };
}

// Formato de entrada do pgvector.
export function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "a",
  "o",
  "as",
  "os",
  "e",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "com",
  "um",
  "uma",
  "que",
  "se",
  "ao",
  "aos",
  "ou",
  "qual",
  "quais",
  "quanto",
  "quantos",
  "mes",
  "ano",
]);

// Termos da pergunta para o `to_tsquery` (união com `|`). Só letras e dígitos, sem acento: o servidor aplica
// `unaccent` ao texto indexado. Nomes como TGFCAB entram inteiros, e é isso que a busca textual precisa pegar.
export function textQueryTerms(question: string): string[] {
  const terms = stripAccents(question)
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return [...new Set(terms)];
}

export function toTsQuery(question: string): string {
  return textQueryTerms(question).join(" | ");
}
