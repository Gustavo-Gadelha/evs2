"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { history, savedQueries, toDraft, type HistoryEntry, type QueryDraft, type SavedQuery } from "@/lib/history";
import { emptyQueryState, type QueryState } from "@/lib/sql/query-state";
import { checkReadOnly } from "@/lib/sql/read-only";
import { toOracleSql } from "@/lib/sql/to-oracle";
import type { ApiError, AuthStatus, QueryResult } from "@/lib/types";
import { presets, type Preset } from "@/presets";
import { AuthHeader } from "./auth-header";
import { Builder } from "./builder/builder";
import { ResultView } from "./result-view";
import { Sidebar } from "./sidebar";
import { SqlEditor } from "./sql-editor";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (data as ApiError | null)?.error?.message ?? `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return data as T;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function Explorer() {
  const [queryState, setQueryState] = useState<QueryState>(emptyQueryState);
  const [sql, setSql] = useState("");
  const [manual, setManual] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>([]);
  const [saved, setSaved] = useState<SavedQuery[]>([]);

  const generated = useMemo(() => toOracleSql(queryState), [queryState]);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api<AuthStatus>("/api/sankhya/status"));
    } catch (err) {
      setAuthError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    // Carregado após montar: `localStorage` e a rota de status só existem no navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryItems(history.list());
    setSaved(savedQueries.list());
    void refreshStatus();
  }, [refreshStatus]);

  // O editor acompanha o builder até a primeira edição manual; com problemas, mantém o último SQL válido.
  function changeState(next: QueryState) {
    setQueryState(next);
    if (manual) return;
    const { sql: nextSql, problems } = toOracleSql(next);
    if (problems.length === 0) setSql(nextSql);
  }

  function changeSql(next: string) {
    setSql(next);
    setManual(true);
  }

  function regenerate() {
    if (generated.problems.length > 0) return;
    setSql(generated.sql);
    setManual(false);
  }

  function load(draft: QueryDraft, previous?: HistoryEntry) {
    const next = toDraft(draft);
    setQueryState(next.state);
    setSql(next.sql);
    setManual(next.manual);
    setResult(previous?.result ?? null);
    setError(previous?.error ?? null);
  }

  function loadPreset(preset: Preset) {
    const state = structuredClone(preset.state);
    load({ state, sql: toOracleSql(state).sql, manual: false });
  }

  const run = useCallback(async () => {
    const check = checkReadOnly(sql);
    if (!check.ok) {
      setResult(null);
      setError(check.reason);
      return;
    }

    const draft: QueryDraft = { state: queryState, sql, manual };
    setRunning(true);
    setError(null);
    try {
      const next = await api<QueryResult>("/api/sankhya/query", { method: "POST", body: JSON.stringify({ sql }) });
      setResult(next);
      setHistoryItems(history.add(draft, { result: next }));
    } catch (err) {
      const message = messageOf(err);
      setResult(null);
      setError(message);
      setHistoryItems(history.add(draft, { error: message }));
    } finally {
      setRunning(false);
      void refreshStatus();
    }
  }, [sql, queryState, manual, refreshStatus]);

  // Ctrl/Cmd+Enter roda de qualquer lugar da página.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void runRef.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function authAction(path: "/api/sankhya/login" | "/api/sankhya/logout") {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await api(path, { method: "POST" });
    } catch (err) {
      setAuthError(messageOf(err));
    } finally {
      setAuthBusy(false);
      void refreshStatus();
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader
        status={status}
        busy={authBusy}
        onLogin={() => authAction("/api/sankhya/login")}
        onLogout={() => authAction("/api/sankhya/logout")}
      />
      {authError && (
        <div className="border-b border-red-900 bg-red-950/60 px-4 py-2 text-sm text-red-200">{authError}</div>
      )}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)]">
        <Sidebar
          presets={presets}
          history={historyItems}
          saved={saved}
          onLoadPreset={loadPreset}
          onLoadHistory={(entry) => load(entry, entry)}
          onLoadSaved={(query) => load(query)}
          onSaveHistory={(name, entry) => setSaved(savedQueries.save(name, entry))}
          onRemoveSaved={(id) => setSaved(savedQueries.remove(id))}
          onClearHistory={() => setHistoryItems(history.clear())}
        />
        <main className="min-w-0 p-4">
          <Builder state={queryState} problems={generated.problems} onChange={changeState} />
        </main>
        <div className="flex min-w-0 flex-col gap-4 p-4 lg:col-start-2 xl:col-start-auto">
          <SqlEditor
            sql={sql}
            manual={manual}
            running={running}
            canRegenerate={generated.problems.length === 0}
            onChange={changeSql}
            onRegenerate={regenerate}
            onRun={run}
            onSave={(name) => setSaved(savedQueries.save(name, { state: queryState, sql, manual }))}
          />
          <ResultView result={result} error={error} />
        </div>
      </div>
    </div>
  );
}
