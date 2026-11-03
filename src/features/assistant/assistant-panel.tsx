"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  ChevronRightIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  MessageSquareTextIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { checkReadOnly } from "@/lib/sql/read-only";
import { useHighlightedCode } from "@/hooks/use-highlighted-code";
import { Badge } from "@/components/ui/badge";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
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
  limitStyle: "fetch" | "rownum";
  // Pedido de "Corrigir com IA" vindo da área de resultado: o `id` muda a cada clique.
  fix: { id: number; error: string } | null;
};

const FIX_MESSAGE = "Corrija o SQL do editor: o Oracle devolveu um erro.";

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

// Atividade do agente, como as chamadas de ferramenta do Claude Code: aberta enquanto responde, recolhida depois.
function AgentSteps({ steps, pending }: { steps: string[]; pending: boolean }) {
  const [open, setOpen] = useState(pending);
  const wasPending = useRef(pending);
  useEffect(() => {
    if (wasPending.current && !pending) setOpen(false);
    wasPending.current = pending;
  }, [pending]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group/steps flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRightIcon className="size-3.5 transition-transform group-data-[panel-open]/steps:rotate-90" />
        {steps.length} {steps.length === 1 ? "etapa" : "etapas"}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {steps.map((step, index) => {
            const current = pending && index === steps.length - 1;
            return (
              <li key={index} className="flex items-center gap-2">
                <span className="font-mono">⎿</span>
                {current ? <Spinner className="size-3" /> : <span>✓</span>}
                <span className={current ? "shimmer text-foreground" : ""}>{step}</span>
              </li>
            );
          })}
        </ol>
      </CollapsibleContent>
    </Collapsible>
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
  const hasSteps = !!message.steps?.length;
  return (
    <Message>
      <MessageAvatar className="font-mono text-sm leading-5">
        <span className={pending ? "shimmer" : "text-primary"}>●</span>
      </MessageAvatar>
      <MessageContent className="gap-2 text-sm">
        {hasSteps && <AgentSteps steps={message.steps!} pending={pending} />}
        {parts.length === 0 && pending && !hasSteps && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Spinner className="size-3.5" />
            <span className="shimmer">Pensando…</span>
          </p>
        )}
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
        {message.interrupted && (
          <Marker>
            <MarkerIcon>
              <SquareIcon />
            </MarkerIcon>
            <MarkerContent>Interrompido</MarkerContent>
          </Marker>
        )}
      </MessageContent>
    </Message>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <Message>
      <MessageContent className="w-full flex-row gap-2 rounded-md border-l-2 border-primary bg-muted px-3 py-2 text-sm">
        <span className="font-mono text-muted-foreground">›</span>
        <span className="min-w-0 whitespace-pre-wrap">{message.content}</span>
      </MessageContent>
    </Message>
  );
}

export function AssistantPanel({ tabId, chat, sql, onChatChange, onUseSql, onOpenInNewTab, limitStyle, fix }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const form = useRef<HTMLFormElement>(null);

  // Trocar de aba de consulta desmonta o painel: a resposta em andamento é interrompida.
  useEffect(() => () => abort.current?.abort(), []);

  // O pedido de correção chega uma vez por `id`; o painel fica montado (keepMounted), então o efeito dispara na hora.
  const handledFix = useRef<number | null>(fix?.id ?? null);
  useEffect(() => {
    if (!fix || fix.id === handledFix.current) return;
    handledFix.current = fix.id;
    void send(FIX_MESSAGE, fix.error);
  });

  async function send(text: string, error?: string) {
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
      await streamChat(
        { messages: history, sql, limitStyle, error },
        controller.signal,
        (delta) =>
          onChatChange(tabId, (current) =>
            current.map((message) =>
              message.id === reply.id ? { ...message, content: message.content + delta } : message,
            ),
          ),
        (step) =>
          onChatChange(tabId, (current) =>
            current.map((message) =>
              message.id === reply.id ? { ...message, steps: [...(message.steps ?? []), step] } : message,
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
      // Resposta vazia (erro antes do primeiro pedaço ou interrupção imediata) não fica na conversa;
      // as etapas ficam (recolhidas) e uma resposta parada pelo usuário é marcada como interrompida.
      const interrupted = controller.signal.aborted;
      onChatChange(tabId, (current) =>
        current
          .filter((message) => message.id !== reply.id || message.content)
          .map((message) => (message.id === reply.id && interrupted ? { ...message, interrupted: true } : message)),
      );
      abort.current = null;
      setBusy(false);
    }
  }

  const lastId = chat[chat.length - 1]?.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <span className="label">Assistente</span>
        <Badge variant="outline" className="h-4 rounded px-1.5 text-[10px] uppercase">
          ollama local
        </Badge>
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

      <div className="relative flex min-h-80 flex-1">
        <MessageScrollerProvider autoScroll>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent className="gap-5">
                {chat.length === 0 && (
                  <Empty className="m-auto">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <MessageSquareTextIcon />
                      </EmptyMedia>
                      <EmptyTitle>Peça uma consulta</EmptyTitle>
                      <EmptyDescription>
                        Descreva o que você precisa e o assistente sugere o SQL, usando o dicionário do Sankhya.
                      </EmptyDescription>
                    </EmptyHeader>
                    <div className="flex flex-col items-stretch">
                      {SUGGESTIONS.map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="justify-start text-muted-foreground"
                          disabled={busy}
                          onClick={() => void send(suggestion)}
                        >
                          <span className="font-mono">›</span> {suggestion}
                        </Button>
                      ))}
                    </div>
                  </Empty>
                )}
                {chat.map((message) => (
                  <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={message.role === "user"}>
                    {message.role === "user" ? (
                      <UserMessage message={message} />
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

      <form
        ref={form}
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <InputGroup>
          <InputGroupAddon align="inline-start">
            <span className="font-mono">›</span>
          </InputGroupAddon>
          <InputGroupTextarea
            className="max-h-40 min-h-9"
            rows={1}
            value={input}
            placeholder="Descreva a consulta…"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && busy) {
                abort.current?.abort();
              } else if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                form.current?.requestSubmit();
              }
            }}
          />
          <InputGroupAddon align="inline-end">
            {busy ? (
              <InputGroupButton variant="outline" size="icon-sm" aria-label="Parar" onClick={() => abort.current?.abort()}>
                <SquareIcon />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                type="submit"
                variant="default"
                size="icon-sm"
                aria-label="Enviar"
                disabled={!input.trim()}
              >
                <ArrowUpIcon />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            <Kbd>Enter</Kbd> envia
          </span>
          <span>
            <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> nova linha
          </span>
          <span>
            <Kbd>Esc</Kbd> para
          </span>
          <span className="ml-auto">Respostas de IA podem errar: revise o SQL.</span>
        </p>
      </form>
    </div>
  );
}
