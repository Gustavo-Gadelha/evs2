import type { DictionaryEntry } from "./types";

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Entradas com as chaves de busca já normalizadas: montado uma vez por carga do dicionário.
export type SearchIndex = { entry: DictionaryEntry; name: string; description: string }[];

export function buildIndex(entries: DictionaryEntry[]): SearchIndex {
  return entries.map((entry) => ({ entry, name: normalize(entry.name), description: normalize(entry.description) }));
}

// Prefixo do nome primeiro, depois nome que contém, depois descrição que contém; corta em `limit`.
export function search(index: SearchIndex, query: string, limit = 50): DictionaryEntry[] {
  const needle = normalize(query.trim());
  if (!needle) return index.slice(0, limit).map((item) => item.entry);
  const prefix: DictionaryEntry[] = [];
  const inName: DictionaryEntry[] = [];
  const inDescription: DictionaryEntry[] = [];
  for (const item of index) {
    if (prefix.length >= limit) break;
    if (item.name.startsWith(needle)) prefix.push(item.entry);
    else if (inName.length + prefix.length < limit && item.name.includes(needle)) inName.push(item.entry);
    else if (inName.length + prefix.length + inDescription.length < limit && item.description.includes(needle)) {
      inDescription.push(item.entry);
    }
  }
  return [...prefix, ...inName, ...inDescription].slice(0, limit);
}
