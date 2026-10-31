import { api } from "@/lib/api";
import type { DictionaryEntry, TableDetail } from "@/lib/types";

// Cache de promessas no navegador: uma requisição por tabela; falhas saem do cache para tentar de novo.
let tables: Promise<DictionaryEntry[]> | null = null;
const columns = new Map<string, Promise<DictionaryEntry[]>>();
const details = new Map<string, Promise<TableDetail>>();

function remember<T>(promise: Promise<T>, forget: () => void): Promise<T> {
  promise.catch(forget);
  return promise;
}

// Quem mostra dados do dicionário (autocomplete) se inscreve para recarregar quando ele é invalidado.
const listeners = new Set<() => void>();

export function subscribeDictionary(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Ao trocar de perfil o dicionário é outro: descarta as promessas guardadas.
export function resetDictionary(): void {
  tables = null;
  columns.clear();
  details.clear();
}

// Invalida o cache do servidor e do navegador e lê as tabelas de novo no ERP; as colunas voltam sob demanda.
export function refreshDictionary(): Promise<DictionaryEntry[]> {
  columns.clear();
  details.clear();
  const pending = remember(
    api<DictionaryEntry[]>("/api/sankhya/dictionary/refresh", { method: "POST" }),
    () => (tables = null),
  );
  tables = pending;
  pending.then(
    () => listeners.forEach((listener) => listener()),
    () => {},
  );
  return pending;
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

// Colunas com tipo e domínio, mais as ligações da tabela com outras (TDDCAM, TDDOPC, TDDLIG).
export function loadTableDetail(table: string): Promise<TableDetail> {
  const name = table.trim().toUpperCase().split(".").pop() ?? "";
  let pending = details.get(name);
  if (!pending) {
    pending = remember(api<TableDetail>(`/api/sankhya/dictionary/table?table=${encodeURIComponent(name)}`), () =>
      details.delete(name),
    );
    details.set(name, pending);
  }
  return pending;
}
