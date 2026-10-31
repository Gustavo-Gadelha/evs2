import "server-only";

import type { DictionaryEntry } from "@/lib/types";
import { checkReadOnly } from "@/lib/sql/read-only";
import { executeQuery } from "@/features/query/server/execute";
import { requireProfile } from "@/features/sankhya/server/auth";

// Dicionário de dados do Sankhya (TDDTAB/TDDCAM), lido pelo mesmo `executeQuery`. O SQL é montado aqui;
// o navegador só informa o nome da tabela, validado antes de entrar na consulta.
const TABLES_SQL = "SELECT NOMETAB, DESCRTAB FROM TDDTAB ORDER BY NOMETAB";
const IDENT = /^[A-Z_][A-Z0-9_$#]*$/;

export class InvalidTableError extends Error {
  constructor(table: string) {
    super(`Nome de tabela inválido: "${table}".`);
    this.name = "InvalidTableError";
  }
}

type Cache = { tables?: DictionaryEntry[]; columns: Map<string, DictionaryEntry[]> };

// No `globalThis` para sobreviver ao HMR, como o token da sessão. Um cache por perfil: cada um pode ser outro ERP.
const store = globalThis as typeof globalThis & { __dictionary?: Map<string, Cache> };

async function cacheOfActiveProfile(): Promise<Cache> {
  const { id } = await requireProfile();
  const caches = (store.__dictionary ??= new Map());
  let cache = caches.get(id);
  if (!cache) caches.set(id, (cache = { columns: new Map() }));
  return cache;
}

// Esquece o que foi lido do ERP para o perfil ativo: a próxima leitura consulta o Sankhya de novo.
export async function invalidateDictionary(): Promise<void> {
  const { id } = await requireProfile();
  store.__dictionary?.delete(id);
}

async function entries(sql: string): Promise<DictionaryEntry[]> {
  const check = checkReadOnly(sql);
  if (!check.ok) throw new Error(check.reason);

  const { rows } = await executeQuery(sql);
  return rows.map((row) => ({ name: String(row[0] ?? ""), description: String(row[1] ?? "") })).filter((entry) => entry.name);
}

export async function listTables(): Promise<DictionaryEntry[]> {
  const cache = await cacheOfActiveProfile();
  return (cache.tables ??= await entries(TABLES_SQL));
}

export async function listColumns(table: string): Promise<DictionaryEntry[]> {
  // Aceita `OWNER.TABELA`: o dicionário só conhece o nome da tabela.
  const name = table.trim().toUpperCase().split(".").pop() ?? "";
  if (!IDENT.test(name)) throw new InvalidTableError(table);

  const cache = await cacheOfActiveProfile();
  const cached = cache.columns.get(name);
  if (cached) return cached;

  const columns = await entries(
    `SELECT NOMECAMPO, DESCRCAMPO FROM TDDCAM WHERE NOMETAB = '${name}' ORDER BY NOMECAMPO`,
  );
  cache.columns.set(name, columns);
  return columns;
}
