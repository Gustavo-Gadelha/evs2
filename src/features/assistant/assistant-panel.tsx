"use client";

import { useEffect, useRef, useState } from "react";
import { DatabaseIcon, ExternalLinkIcon, SendIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { checkReadOnly } from "@/lib/sql/read-only";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFooter,
  CodeBlockHeader,
  CodeBlockLine,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
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
  const lines = useHighlightedCode(code, "sql");
  const check = checkReadOnly(code);
  const blocked = open || !check.ok;

  return (
    <CodeBlock size="sm">
      <CodeBlockHeader>
        <CodeBlockTitle>
          <DatabaseIcon />
          SQL
        </CodeBlockTitle>
        <CodeBlockActions>
          <CodeBlockCopyButton value={code} disabled={open} />
        </CodeBlockActions>
      </CodeBlockHeader>
      <CodeBlockContent>
        {lines.map((line, index) => (
          <CodeBlockLine key={index}>{line}</CodeBlockLine>
        ))}
      </CodeBlockContent>
      <CodeBlockFooter className="flex-wrap">
        <Button size="xs" type="button" disabled={blocked} onClick={onUse}>
          Usar no editor
        </Button>
        <Button size="xs" variant="outline" type="button" disabled={blocked} onClick={onOpenInNewTab}>
          <ExternalLinkIcon /> Abrir em nova aba
        </Button>
        {!open && !check.ok && <span className="text-xs text-amber-300">{check.reason}</span>}
      </CodeBlockFooter>
    </CodeBlock>
  );
}

function AssistantMessage({
  message,
  pending,
  onUseSql,
  onOpenInNewTab,
}: {
  message: ChatMessage;
  pending: boolean;
  onUseSql: (sql: string) => void;
  onOpenInNewTab: (sql: string) => void;
}) {
  const parts = splitMessage(message.content);
  return (
    <Message>
      <MessageContent>
        {parts.length === 0 && pending && <p className="text-muted-foreground">Pensando…</p>}
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
      </MessageContent>
    </Message>
  );
}

export function AssistantPanel({ tabId, chat, sql, onChatChange, onUseSql, onOpenInNewTab }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);

  // Trocar de aba de consulta desmonta o painel: a resposta em andamento é interrompida.
  useEffect(() => () => abort.current?.abort(), []);

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

  const lastId = chat[chat.length - 1]?.id;

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

      <div className="relative flex min-h-80 flex-1 rounded-lg border border-border bg-card">
        <MessageScrollerProvider autoScroll>
          <MessageScroller>
            <MessageScrollerViewport className="p-3">
              <MessageScrollerContent>
                {chat.length === 0 && (
                  <p className="m-auto max-w-sm text-center text-sm text-muted-foreground">
                    Descreva o que você precisa e o assistente sugere o SQL, usando o dicionário do Sankhya.
                  </p>
                )}
                {chat.map((message) => (
                  <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}>
                    {message.role === "user" ? (
                      <Message align="end">
                        <MessageContent>
                          <Bubble align="end" variant="tinted">
                            <BubbleContent className="whitespace-pre-wrap">{message.content}</BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    ) : (
                      <AssistantMessage
                        message={message}
                        pending={busy && message.id === lastId}
                        onUseSql={onUseSql}
                        onOpenInNewTab={onOpenInNewTab}
                      />
                    )}
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>

      {chat.length === 0 && (
        <div className="flex scroll-fade-x gap-2 overflow-x-auto overscroll-x-contain">
          {SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion}
              variant="outline"
              size="sm"
              type="button"
              className="shrink-0"
              disabled={busy}
              onClick={() => void send(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <InputGroup>
          <InputGroupTextarea
            className="max-h-40 min-h-9"
            rows={1}
            value={input}
            placeholder="Descreva a consulta… (Enter envia, Shift+Enter quebra a linha)"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                form.current?.requestSubmit();
              }
            }}
          />
          <InputGroupAddon align="block-end">
            <span className="text-xs text-muted-foreground">Respostas de IA podem errar: revise o SQL.</span>
            {busy ? (
              <InputGroupButton className="ml-auto" variant="outline" size="sm" onClick={() => abort.current?.abort()}>
                <SquareIcon /> Parar
              </InputGroupButton>
            ) : (
              <InputGroupButton className="ml-auto" type="submit" variant="default" size="sm" disabled={!input.trim()}>
                <SendIcon /> Enviar
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}
