"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import {
  history,
  savedQueries,
  toDraft,
  type HistoryEntry,
  type HistoryItem,
  type QueryDraft,
  type SavedQuery,
} from "@/features/history/history";
import { emptyQueryState, type QueryState } from "@/lib/sql/query-state";
import { QueryTabs } from "./query-tabs";
import { newTab, type Tab } from "./tabs";
import { checkReadOnly } from "@/lib/sql/read-only";
import { addRelationJoin } from "@/lib/sql/add-join";
import { toOracleSql } from "@/lib/sql/to-oracle";
import type { AuthStatus, QueryResult, Relation } from "@/lib/types";
import { AuthHeader } from "@/features/sankhya/components/auth-header";
import { DictionaryBrowser } from "@/features/dictionary/components/dictionary-browser";
import { resetDictionary } from "@/features/dictionary/client";
import { ProfilesDialog } from "@/features/profiles/components/profiles-dialog";
import { profiles, type ProfilesState } from "@/features/profiles/profiles";
import { Builder } from "@/features/builder/builder";
import { ResultView } from "@/features/results/result-view";
import { Sidebar } from "@/features/history/components/sidebar";
import { SqlEditor } from "@/features/query/components/sql-editor";
import { AssistantPanel } from "@/features/assistant/assistant-panel";
import type { ChatMessage } from "@/features/assistant/protocol";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Falha de banco de dados (histórico e consultas salvas): id fixo para não empilhar avisos repetidos.
function notifyStoreError(err: unknown) {
  toast.warning("Falha ao acessar o banco de dados", { id: "store", description: messageOf(err) });
}

export function Explorer() {
  const [tabs, setTabs] = useState<Tab[]>(() => [newTab(1)]);
  const [activeId, setActiveId] = useState("tab-1");
  const nextNumber = useRef(2);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [profileState, setProfileState] = useState<ProfilesState>({ profiles: [], activeId: null });
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [mode, setMode] = useState<"builder" | "assistant">("builder");

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const { state: queryState, sql, manual, result, error, running } = active;

  const generated = useMemo(() => toOracleSql(queryState), [queryState]);

  // Altera uma aba pelo id: uma consulta que termina depois de a aba ser fechada ou trocada não afeta outra.
  const patchTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));
  }, []);

  function addTab(patch: Partial<Tab> = {}) {
    const tab = { ...newTab(nextNumber.current++), ...patch };
    setTabs((current) => [...current, tab]);
    setActiveId(tab.id);
  }

  // Fecha várias abas de uma vez. Sobrando nenhuma, volta uma em branco. Se a ativa for fechada, fica ativa
  // `focusId` (a aba do menu de contexto) ou, sem ele, a vizinha que sobrou, de preferência a da direita.
  function closeTabs(ids: string[], focusId?: string) {
    const closing = new Set(ids);
    const rest = tabs.filter((tab) => !closing.has(tab.id));
    if (rest.length === tabs.length) return;
    if (rest.length === 0) {
      const fresh = newTab(nextNumber.current++);
      setTabs([fresh]);
      setActiveId(fresh.id);
      return;
    }
    setTabs(rest);
    if (!closing.has(activeId)) return;
    if (focusId && rest.some((tab) => tab.id === focusId)) {
      setActiveId(focusId);
      return;
    }
    const activeIndex = tabs.findIndex((tab) => tab.id === activeId);
    const next = tabs.slice(activeIndex).find((tab) => !closing.has(tab.id)) ?? rest[rest.length - 1];
    setActiveId(next.id);
  }

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api<AuthStatus>("/api/sankhya/status"));
    } catch (err) {
      toast.error("Não foi possível ler o status da sessão", { description: messageOf(err) });
    }
  }, []);

  // Sem perfil ativo não há credenciais: o aviso fica até existir um perfil.
  const noProfile = status !== null && !status.profile;
  useEffect(() => {
    if (!noProfile) {
      toast.dismiss("no-profile");
      return;
    }
    toast.warning("Nenhum perfil ativo", {
      id: "no-profile",
      duration: Infinity,
      description: "Cadastre as credenciais do Sankhya em Perfis.",
      action: { label: "Abrir Perfis", onClick: () => setProfilesOpen(true) },
    });
  }, [noProfile]);

  useEffect(() => {
    // Carregado após montar: histórico e consultas salvas vêm das rotas, a de status só existe no navegador.
    void (async () => {
      try {
        const imported = await savedQueries.importLegacy();
        setSaved(imported ?? (await savedQueries.list()));
        setHistoryItems(await history.list());
      } catch (err) {
        notifyStoreError(err);
      }
    })();
    void refreshStatus();
    void profiles
      .list()
      .then(setProfileState, (err) =>
        toast.error("Não foi possível carregar os perfis", { description: messageOf(err) }),
      );
  }, [refreshStatus]);

  // Trocar, editar ou excluir perfis muda o ERP: o dicionário e o resultado em tela deixam de valer.
  function changeProfiles(next: ProfilesState) {
    const switched = next.activeId !== profileState.activeId;
    setProfileState(next);
    if (switched) {
      resetDictionary();
      setTabs((current) => current.map((tab) => ({ ...tab, result: null, error: null })));
    }
    void refreshStatus();
  }

  async function selectProfile(id: string | null) {
    setAuthBusy(true);
    try {
      changeProfiles(await profiles.activate(id));
    } catch (err) {
      toast.error("Falha ao trocar de perfil", { description: messageOf(err) });
    } finally {
      setAuthBusy(false);
    }
  }

  // O editor acompanha o builder até a primeira edição manual; com problemas, mantém o último SQL válido.
  function changeState(next: QueryState) {
    const { sql: nextSql, problems } = toOracleSql(next);
    patchTab(active.id, !manual && problems.length === 0 ? { state: next, sql: nextSql } : { state: next });
  }

  // Do dicionário: substitui a consulta por um SELECT de 20 linhas da tabela.
  function previewTable(table: string) {
    changeState({ ...emptyQueryState(), from: { table, alias: "" }, limit: { rows: 20, offset: 0, style: "fetch" } });
    setDictionaryOpen(false);
  }

  // Do dicionário: acrescenta ao builder o JOIN de uma ligação da tabela, que já precisa estar na consulta.
  function addJoin(table: string, relation: Relation) {
    const next = addRelationJoin(queryState, table, relation);
    if (!next) {
      toast.warning(`${table} não está no FROM nem em um JOIN`, { id: "add-join" });
      return;
    }
    changeState(next);
    toast.success(`JOIN com ${relation.table} adicionado`, { id: "add-join" });
  }

  // A resposta do assistente chega aos poucos: grava na aba que perguntou, mesmo que outra esteja ativa.
  const changeChat = useCallback((id: string, update: (chat: ChatMessage[]) => ChatMessage[]) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, chat: update(tab.chat) } : tab)));
  }, []);

  function changeSql(next: string) {
    patchTab(active.id, { sql: next, manual: true });
  }

  function regenerate() {
    if (generated.problems.length > 0) return;
    patchTab(active.id, { sql: generated.sql, manual: false });
  }

  // Gravar no banco nunca derruba a consulta: a falha vira um aviso e a tela segue como está.
  async function persist<T>(action: Promise<T>, apply: (value: T) => void) {
    try {
      apply(await action);
      toast.dismiss("store");
    } catch (err) {
      notifyStoreError(err);
    }
  }

  async function loadHistory(item: HistoryItem, inNewTab = false) {
    let entry: HistoryEntry = item;
    if (item.hasResult) {
      try {
        entry = await history.get(item.id);
      } catch (err) {
        notifyStoreError(err);
      }
    }
    load(entry, entry, inNewTab);
  }

  // Histórico e consultas salvas substituem a aba ativa; só abrem outra aba quando o usuário pede ("Abrir em nova aba").
  // Com a consulta da aba ainda rodando, não substitui: o resultado dela cairia sobre o que foi carregado.
  function load(draft: QueryDraft, previous?: HistoryEntry, inNewTab = false) {
    if (!inNewTab && active.running) {
      toast.warning("A consulta desta aba ainda está rodando", { id: "load-running" });
      return;
    }
    const next = toDraft(draft);
    const patch: Partial<Tab> = {
      state: next.state,
      sql: next.sql,
      manual: next.manual,
      result: previous?.result ?? null,
      error: previous?.error ?? null,
    };
    if (inNewTab) addTab(patch);
    else patchTab(active.id, patch);
  }

  function newQuery() {
    addTab();
  }

  const run = useCallback(async () => {
    if (running) return;
    const id = active.id;
    if (!status?.profile) {
      patchTab(id, { result: null, error: "Nenhum perfil ativo. Cadastre e selecione um perfil de acesso." });
      return;
    }
    const check = checkReadOnly(sql);
    if (!check.ok) {
      patchTab(id, { result: null, error: check.reason });
      return;
    }

    const draft: QueryDraft = { state: queryState, sql, manual };
    patchTab(id, { running: true, error: null });
    try {
      const next = await api<QueryResult>("/api/sankhya/query", { method: "POST", body: JSON.stringify({ sql }) });
      patchTab(id, { result: next });
      void persist(history.add(draft, { result: next }), setHistoryItems);
    } catch (err) {
      const message = messageOf(err);
      patchTab(id, { result: null, error: message });
      void persist(history.add(draft, { error: message }), setHistoryItems);
    } finally {
      patchTab(id, { running: false });
      void refreshStatus();
    }
  }, [active.id, running, sql, queryState, manual, patchTab, refreshStatus, status]);

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
    try {
      await api(path, { method: "POST" });
    } catch (err) {
      toast.error(path.endsWith("/login") ? "Falha no login" : "Falha no logout", { description: messageOf(err) });
    } finally {
      setAuthBusy(false);
      void refreshStatus();
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <Toaster theme="dark" position="bottom-right" closeButton />
      <AuthHeader
        status={status}
        profiles={profileState.profiles}
        activeId={profileState.activeId}
        busy={authBusy}
        onOpenProfiles={() => setProfilesOpen(true)}
        onSelectProfile={(id) => void selectProfile(id)}
        onLogin={() => authAction("/api/sankhya/login")}
        onLogout={() => authAction("/api/sankhya/logout")}
      />
      {dictionaryOpen && (
        <DictionaryBrowser
          state={queryState}
          onClose={() => setDictionaryOpen(false)}
          onPreview={previewTable}
          onAddJoin={addJoin}
        />
      )}
      {profilesOpen && (
        <ProfilesDialog state={profileState} onChange={changeProfiles} onClose={() => setProfilesOpen(false)} />
      )}
      <QueryTabs tabs={tabs} activeId={active.id} onSelect={setActiveId} onClose={closeTabs} onAdd={() => addTab()} />
      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_minmax(0,1fr)]">
        <Sidebar
          history={historyItems}
          saved={saved}
          onLoadHistory={(item, inNewTab) => void loadHistory(item, inNewTab)}
          onLoadSaved={(query) => load(query)}
          onSaveHistory={(name, item) => void persist(savedQueries.save(name, item), setSaved)}
          onRemoveHistory={(id) => void persist(history.remove(id), setHistoryItems)}
          onRemoveSaved={(id) => void persist(savedQueries.remove(id), setSaved)}
          onClearHistory={() => void persist(history.clear(), setHistoryItems)}
          onNewQuery={newQuery}
          onOpenDictionary={() => setDictionaryOpen(true)}
        />
        {/* Do lg em diante cada coluna rola sozinha e a página não passa da altura da janela. */}
        <div className="flex min-w-0 flex-col lg:min-h-0 lg:overflow-y-auto xl:contents">
          <main className="flex min-w-0 flex-col gap-3 p-4 xl:min-h-0 xl:overflow-y-auto">
            {/* keepMounted: alternar não perde o estado de seções do builder nem interrompe a resposta do assistente. */}
            <Tabs value={mode} onValueChange={(value) => setMode(value as "builder" | "assistant")} className="flex-1">
              <TabsList>
                <TabsTrigger value="builder">Builder</TabsTrigger>
                <TabsTrigger value="assistant">
                  <SparklesIcon /> Assistente
                </TabsTrigger>
              </TabsList>
              <TabsContent value="builder" keepMounted>
                <Builder
                  key={`${active.id}-${status?.profile?.id ?? "none"}`}
                  state={queryState}
                  problems={generated.problems}
                  onChange={changeState}
                />
              </TabsContent>
              <TabsContent value="assistant" keepMounted className="flex min-h-0 flex-col">
                <AssistantPanel
                  key={active.id}
                  tabId={active.id}
                  chat={active.chat}
                  sql={sql}
                  onChatChange={changeChat}
                  onUseSql={changeSql}
                  onOpenInNewTab={(next) => addTab({ sql: next, manual: true })}
                />
              </TabsContent>
            </Tabs>
          </main>
          <div className="flex min-w-0 flex-col gap-4 p-4 xl:min-h-0 xl:overflow-y-auto">
            <SqlEditor
              key={`${active.id}-${status?.profile?.id ?? "none"}`}
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
    </div>
  );
}
