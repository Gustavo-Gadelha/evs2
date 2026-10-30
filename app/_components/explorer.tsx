"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { history, savedQueries, toDraft, type HistoryEntry, type HistoryItem, type QueryDraft, type SavedQuery } from "@/lib/history";
import { emptyQueryState, type QueryState } from "@/lib/sql/query-state";
import { checkReadOnly } from "@/lib/sql/read-only";
import { toOracleSql } from "@/lib/sql/to-oracle";
import type { AuthStatus, QueryResult } from "@/lib/types";
import { AuthHeader } from "./auth-header";
import { DictionaryBrowser } from "./dictionary-browser";
import { Builder } from "./builder/builder";
import { ResultView } from "./result-view";
import { Sidebar } from "./sidebar";
import { SqlEditor } from "./sql-editor";

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
  const [storeError, setStoreError] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
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
    // Carregado após montar: histórico e consultas salvas vêm das rotas, a de status só existe no navegador.
    void (async () => {
      try {
        const imported = await savedQueries.importLegacy();
        setSaved(imported ?? (await savedQueries.list()));
        setHistoryItems(await history.list());
      } catch (err) {
        setStoreError(messageOf(err));
      }
    })();
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

  // Gravar no SQLite nunca derruba a consulta: a falha vira um aviso e a tela segue como está.
  async function persist<T>(action: Promise<T>, apply: (value: T) => void) {
    try {
      apply(await action);
      setStoreError(null);
    } catch (err) {
      setStoreError(messageOf(err));
    }
  }

  async function loadHistory(item: HistoryItem) {
    let entry: HistoryEntry = item;
    if (item.hasResult) {
      try {
        entry = await history.get(item.id);
      } catch (err) {
        setStoreError(messageOf(err));
      }
    }
    load(entry, entry);
  }

  function load(draft: QueryDraft, previous?: HistoryEntry) {
    const next = toDraft(draft);
    setQueryState(next.state);
    setSql(next.sql);
    setManual(next.manual);
    setResult(previous?.result ?? null);
    setError(previous?.error ?? null);
  }

  function newQuery() {
    load({ state: emptyQueryState(), sql: "", manual: false });
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
      void persist(history.add(draft, { result: next }), setHistoryItems);
    } catch (err) {
      const message = messageOf(err);
      setResult(null);
      setError(message);
      void persist(history.add(draft, { error: message }), setHistoryItems);
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
        onNewQuery={newQuery}
        onOpenDictionary={() => setDictionaryOpen(true)}
        onLogin={() => authAction("/api/sankhya/login")}
        onLogout={() => authAction("/api/sankhya/logout")}
      />
      {dictionaryOpen && <DictionaryBrowser onClose={() => setDictionaryOpen(false)} />}
      {authError && (
        <div className="border-b border-red-900 bg-red-950/60 px-4 py-2 text-sm text-red-200">{authError}</div>
      )}
      {storeError && (
        <div className="border-b border-amber-900 bg-amber-950/60 px-4 py-2 text-sm text-amber-200">
          Falha ao acessar o banco local: {storeError}
        </div>
      )}
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)]">
        <Sidebar
          history={historyItems}
          saved={saved}
          onLoadHistory={(item) => void loadHistory(item)}
          onLoadSaved={(query) => load(query)}
          onSaveHistory={(name, item) => void persist(savedQueries.save(name, item), setSaved)}
          onRemoveSaved={(id) => void persist(savedQueries.remove(id), setSaved)}
          onClearHistory={() => void persist(history.clear(), setHistoryItems)}
        />
        <main className="flex min-w-0 flex-col gap-3 p-4">
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
            onSave={(name) => void persist(savedQueries.save(name, { state: queryState, sql, manual }), setSaved)}
          />
          <ResultView result={result} error={error} />
        </div>
      </div>
    </div>
  );
}
