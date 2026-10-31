import { api } from "@/lib/api";
import type { DictionaryEntry } from "@/lib/types";

// Cache de promessas no navegador: uma requisição por tabela; falhas saem do cache para tentar de novo.
let tables: Promise<DictionaryEntry[]> | null = null;
const columns = new Map<string, Promise<DictionaryEntry[]>>();

function remember<T>(promise: Promise<T>, forget: () => void): Promise<T> {
  promise.catch(forget);
  return promise;
}

// Ao trocar de perfil o dicionário é outro: descarta as promessas guardadas.
export function resetDictionary(): void {
  tables = null;
  columns.clear();
}

export function loadTables(): Promise<DictionaryEntry[]> {
  return (tables ??= remember(api<DictionaryEntry[]>("/api/sankhya/dictionary/tables"), () => (tables = null)));
}

export function loadColumns(table: string): Promise<DictionaryEntry[]> {
  const name = table.trim().toUpperCase().split(".").pop() ?? "";
  let pending = columns.get(name);
  if (!pending) {
    pending = remember(
      api<DictionaryEntry[]>(`/api/sankhya/dictionary/columns?table=${encodeURIComponent(name)}`),
      () => columns.delete(name),
    );
    columns.set(name, pending);
  }
  return pending;
}
