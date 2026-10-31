"use client";

import { useEffect, useRef, useState } from "react";
import { CopyIcon, ExternalLinkIcon, SendIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { checkReadOnly } from "@/lib/sql/read-only";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { streamChat } from "./client";
import type { ChatMessage } from "./protocol";
import { splitMessage } from "./sql-blocks";

type Props = {
  tabId: string;
  chat: ChatMessage[];
  sql: string;
  onChatChange: (tabId: string, update: (chat: ChatMessage[]) => ChatMessage[]) => void;
  onUseSql: (sql: string) => void;
  onOpenInNewTab: (sql: string) => void;
};

const SUGGESTIONS = [
  "Notas de venda do último mês com o nome do parceiro",
  "Produtos com estoque abaixo do mínimo",
  "Explique o SQL que está no editor",
];

function SqlBlock({
  code,
  open,
  onUse,
  onOpenInNewTab,
}: {
  code: string;
  open: boolean;
  onUse: () => void;
  onOpenInNewTab: () => void;
}) {
  const check = checkReadOnly(code);
  const blocked = open || !check.ok;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("SQL copiado", { id: "assistant-copy" });
    } catch {
      toast.error("Não foi possível copiar", { id: "assistant-copy" });
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <pre className="overflow-x-auto p-2 font-mono text-xs whitespace-pre">{code}</pre>
      {!open && !check.ok && <p className="border-t border-border px-2 py-1 text-xs text-amber-300">{check.reason}</p>}
      <div className="flex flex-wrap items-center gap-1 border-t border-border p-1">
        <Button size="xs" type="button" disabled={blocked} onClick={onUse}>
          Usar no editor
        </Button>
        <Button size="xs" variant="outline" type="button" disabled={blocked} onClick={onOpenInNewTab}>
          <ExternalLinkIcon /> Abrir em nova aba
        </Button>
        <Button size="xs" variant="ghost" type="button" disabled={open} onClick={() => void copy()}>
          <CopyIcon /> Copiar
        </Button>
      </div>
    </div>
  );
}

function Message({
  message,
  onUseSql,
  onOpenInNewTab,
}: {
  message: ChatMessage;
  onUseSql: (sql: string) => void;
  onOpenInNewTab: (sql: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="ml-8 self-end rounded-lg bg-primary/15 px-3 py-2 text-sm whitespace-pre-wrap">
        {message.content}
      </div>
    );
  }
  const parts = splitMessage(message.content);
  return (
    <div className="mr-4 flex flex-col gap-2 text-sm">
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <p key={index} className="whitespace-pre-wrap">
            {part.text}
          </p>
        ) : (
          <SqlBlock
            key={index}
            code={part.code}
            open={part.open}
            onUse={() => onUseSql(part.code)}
            onOpenInNewTab={() => onOpenInNewTab(part.code)}
          />
        ),
      )}
    </div>
  );
}

export function AssistantPanel({ tabId, chat, sql, onChatChange, onUseSql, onOpenInNewTab }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Trocar de aba de consulta desmonta o painel: a resposta em andamento é interrompida.
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [chat]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const reply: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    const history = [...chat, user].map(({ role, content }) => ({ role, content }));
    onChatChange(tabId, (current) => [...current, user, reply]);
    setInput("");

    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    try {
      await streamChat({ messages: history, sql }, controller.signal, (delta) =>
        onChatChange(tabId, (current) =>
          current.map((message) =>
            message.id === reply.id ? { ...message, content: message.content + delta } : message,
          ),
        ),
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        toast.error("Falha no assistente", {
          id: "assistant-error",
          description: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      // Resposta vazia (erro antes do primeiro pedaço ou interrupção imediata) não fica na conversa.
      onChatChange(tabId, (current) => current.filter((message) => message.id !== reply.id || message.content));
      abort.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="label">Assistente</span>
        <Badge className="h-4 rounded px-1.5 text-[10px] uppercase">ollama local</Badge>
        <Button
          className="ml-auto"
          variant="ghost"
          size="xs"
          type="button"
          disabled={chat.length === 0}
          onClick={() => {
            abort.current?.abort();
            onChatChange(tabId, () => []);
          }}
        >
          <Trash2Icon /> Limpar conversa
        </Button>
      </div>

      <div className="flex min-h-64 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-border bg-card p-3">
        {chat.length === 0 ? (
          <div className="m-auto flex max-w-sm flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              Descreva o que você precisa e o assistente sugere o SQL, usando o dicionário do Sankhya.
            </p>
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                type="button"
                className="h-auto whitespace-normal"
                onClick={() => void send(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : (
          chat.map((message) => (
            <Message key={message.id} message={message} onUseSql={onUseSql} onOpenInNewTab={onOpenInNewTab} />
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <Textarea
          className="max-h-40 min-h-9"
          rows={1}
          value={input}
          placeholder="Descreva a consulta… (Enter envia, Shift+Enter quebra a linha)"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
              event.preventDefault();
              void send(input);
            }
          }}
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>
            <SquareIcon /> Parar
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            <SendIcon /> Enviar
          </Button>
        )}
      </form>
      <p className="text-xs text-muted-foreground">Respostas de IA podem errar: revise o SQL antes de rodar.</p>
    </div>
  );
}
