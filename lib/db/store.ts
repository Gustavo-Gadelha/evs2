import "server-only";

import { MAX_HISTORY, MAX_RESULT_BYTES, type HistoryEntry, type HistoryItem, type SavedQuery } from "@/lib/history";
import type { QueryState } from "@/lib/sql/query-state";
import type { QueryResult } from "@/lib/types";
import { db } from "./client";
import type { HistoryEntry as HistoryRow, SavedQuery as SavedRow } from "./generated/client";

export type NewHistory = {
  state: QueryState;
  sql: string;
  manual: boolean;
  rowCount: number | null;
  error: string | null;
  result?: QueryResult;
};

export type NewSaved = { name: string; state: QueryState; sql: string; manual: boolean; savedAt?: string };

function toItem(row: Omit<HistoryRow, "result">, hasResult: boolean): HistoryItem {
  return {
    id: row.id,
    timestamp: row.createdAt.toISOString(),
    sql: row.sql,
    state: JSON.parse(row.state) as QueryState,
    manual: row.manual,
    rowCount: row.rowCount,
    error: row.error,
    hasResult,
  };
}

function toSaved(row: SavedRow): SavedQuery {
  return {
    id: row.id,
    name: row.name,
    savedAt: row.savedAt.toISOString(),
    sql: row.sql,
    state: JSON.parse(row.state) as QueryState,
    manual: row.manual,
  };
}

export async function listHistory(): Promise<HistoryItem[]> {
  // O resultado pode ter MBs: a listagem só pergunta se ele existe (`hasResult`).
  const rows = await db().historyEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: MAX_HISTORY,
    omit: { result: true },
  });
  const withResult = new Set(
    (await db().historyEntry.findMany({ where: { result: { not: null } }, select: { id: true } })).map((row) => row.id),
  );
  return rows.map((row) => toItem(row, withResult.has(row.id)));
}

export async function getHistory(id: string): Promise<HistoryEntry | null> {
  const row = await db().historyEntry.findUnique({ where: { id } });
  if (!row) return null;
  const { hasResult, ...item } = toItem(row, row.result !== null);
  return { ...item, result: hasResult ? (JSON.parse(row.result!) as QueryResult) : undefined };
}

export async function addHistory(entry: NewHistory): Promise<HistoryItem[]> {
  const result = entry.result ? JSON.stringify(entry.result) : null;
  await db().historyEntry.create({
    data: {
      id: crypto.randomUUID(),
      sql: entry.sql,
      state: JSON.stringify(entry.state),
      manual: entry.manual,
      rowCount: entry.rowCount,
      error: entry.error,
      // Mesmo limite que o cliente aplica: a rota não confia no que recebe.
      result: result !== null && Buffer.byteLength(result) <= MAX_RESULT_BYTES ? result : null,
    },
  });
  const stale = await db().historyEntry.findMany({
    orderBy: { createdAt: "desc" },
    skip: MAX_HISTORY,
    select: { id: true },
  });
  if (stale.length > 0) await db().historyEntry.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  return listHistory();
}

export async function clearHistory(): Promise<void> {
  await db().historyEntry.deleteMany();
}

export async function listSaved(): Promise<SavedQuery[]> {
  return (await db().savedQuery.findMany({ orderBy: { savedAt: "desc" } })).map(toSaved);
}

export async function addSaved(query: NewSaved): Promise<SavedQuery[]> {
  await db().savedQuery.create({
    data: {
      id: crypto.randomUUID(),
      name: query.name,
      sql: query.sql,
      state: JSON.stringify(query.state),
      manual: query.manual,
      ...(query.savedAt ? { savedAt: new Date(query.savedAt) } : {}),
    },
  });
  return listSaved();
}

export async function removeSaved(id: string): Promise<SavedQuery[]> {
  await db().savedQuery.deleteMany({ where: { id } });
  return listSaved();
}
