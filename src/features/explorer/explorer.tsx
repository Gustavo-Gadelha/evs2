"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/api";
import { history, savedQueries, toDraft, type HistoryEntry, type HistoryItem, type QueryDraft, type SavedQuery } from "@/features/history/history";
import { emptyQueryState, type QueryState } from "@/lib/sql/query-state";
import { checkReadOnly } from "@/lib/sql/read-only";
import { toOracleSql } from "@/lib/sql/to-oracle";
import type { AuthStatus, QueryResult } from "@/lib/types";
import { AuthHeader } from "@/features/sankhya/components/auth-header";
import { DictionaryBrowser } from "@/features/dictionary/components/dictionary-browser";
import { resetDictionary } from "@/features/dictionary/client";
import { ProfilesDialog } from "@/features/profiles/components/profiles-dialog";
import { profiles, type ProfilesState } from "@/features/profiles/profiles";
import { Builder } from "@/features/builder/builder";
import { ResultView } from "@/features/results/result-view";
import { Sidebar } from "@/features/history/components/sidebar";
import { SqlEditor } from "@/features/query/components/sql-editor";
import { Alert } from "@/components/ui/alert";

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
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [profileState, setProfileState] = useState<ProfilesState>({ profiles: [], activeId: null });
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
    void profiles.list().then(setProfileState, (err) => setAuthError(messageOf(err)));
  }, [refreshStatus]);

  // Trocar, editar ou excluir perfis muda o ERP: o dicionário e o resultado em tela deixam de valer.
  function changeProfiles(next: ProfilesState) {
    const switched = next.activeId !== profileState.activeId;
    setProfileState(next);
    if (switched) {
      resetDictionary();
      setResult(null);
      setError(null);
    }
    void refreshStatus();
  }

  async function selectProfile(id: string | null) {
    setAuthBusy(true);
    setAuthError(null);
    try {
      changeProfiles(await profiles.activate(id));
    } catch (err) {
      setAuthError(messageOf(err));
    } finally {
      setAuthBusy(false);
    }
  }

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
    if (!status?.profile) {
      setResult(null);
      setError("Nenhum perfil ativo. Cadastre e selecione um perfil de acesso.");
      return;
    }
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
  }, [sql, queryState, manual, refreshStatus, status]);

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
        profiles={profileState.profiles}
        activeId={profileState.activeId}
        busy={authBusy}
        onNewQuery={newQuery}
        onOpenDictionary={() => setDictionaryOpen(true)}
        onOpenProfiles={() => setProfilesOpen(true)}
        onSelectProfile={(id) => void selectProfile(id)}
        onLogin={() => authAction("/api/sankhya/login")}
        onLogout={() => authAction("/api/sankhya/logout")}
      />
      {dictionaryOpen && <DictionaryBrowser onClose={() => setDictionaryOpen(false)} />}
      {profilesOpen && (
        <ProfilesDialog state={profileState} onChange={changeProfiles} onClose={() => setProfilesOpen(false)} />
      )}
      {status && !status.profile && (
        <Alert className="rounded-none border-x-0 border-t-0 border-amber-900 bg-amber-950/60 text-amber-200">
          Nenhum perfil de acesso ativo: abra <strong>Perfis</strong> e cadastre as credenciais do Sankhya.
        </Alert>
      )}
      {authError && (
        <Alert variant="destructive" className="rounded-none border-x-0 border-t-0 border-destructive/40 bg-destructive/10">
          {authError}
        </Alert>
      )}
      {storeError && (
        <Alert className="rounded-none border-x-0 border-t-0 border-amber-900 bg-amber-950/60 text-amber-200">
          Falha ao acessar o banco local: {storeError}
        </Alert>
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
          <Builder key={status?.profile?.id ?? "none"} state={queryState} problems={generated.problems} onChange={changeState} />
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
