"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { IndexEvent, IndexStatus } from "../index-protocol";

type Status = { preset: string; chatModel: string; ollama: { reachable: boolean; chatModelReady: boolean } };

// Selo do header: preset e modelo ativos e o estado do índice do dicionário (ausente, desatualizado ou pronto),
// com o botão para indexar. A indexação é cara na CPU, por isso nunca começa sozinha.
export function AiStatus({ profileId }: { profileId: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [index, setIndex] = useState<IndexStatus | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    setStatus(await api<Status>("/api/assistant/status").catch(() => null));
    setIndex(profileId ? await api<IndexStatus>("/api/assistant/index").catch(() => null) : null);
  }, [profileId]);

  useEffect(() => {
    void refresh();
    return () => abort.current?.abort();
  }, [refresh]);

  async function build() {
    const controller = new AbortController();
    abort.current = controller;
    setProgress("Indexando…");
    try {
      const res = await fetch("/api/assistant/index", { method: "POST", signal: controller.signal });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? `${res.status} ${res.statusText}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as IndexEvent;
        if (event.type === "progress") setProgress(`Indexando ${event.done}/${event.total}`);
        else if (event.type === "error") throw new Error(event.message);
        else if (event.type === "done") toast.success(`Índice pronto: ${event.documents} documentos`);
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer);
    } catch (err) {
      if (!controller.signal.aborted) {
        toast.error("Falha ao indexar", {
          id: "ai-index-error",
          description: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      abort.current = null;
      setProgress(null);
      void refresh();
    }
  }

  if (!status) return null;

  const ready = status.ollama.reachable && status.ollama.chatModelReady;
  const state = !index
    ? null
    : !index.built || index.modelMismatch
      ? { label: index.modelMismatch ? "índice de outro modelo" : "sem índice", tone: "bg-red-500/15 text-red-300" }
      : index.stale
        ? { label: "índice desatualizado", tone: "bg-amber-500/15 text-amber-300" }
        : { label: "índice pronto", tone: "bg-emerald-500/15 text-emerald-300" };
  const upToDate = !!index?.built && !index.stale && !index.modelMismatch;

  return (
    <div className="flex items-center gap-2">
      <Badge
        className={`h-5 gap-1 rounded px-1.5 text-[10px] ${ready ? "" : "bg-red-500/15 text-red-300"}`}
        title={
          status.ollama.reachable ? (ready ? "Ollama local" : "Modelo de chat não baixado") : "Ollama indisponível"
        }
      >
        <SparklesIcon className="size-3" aria-hidden />
        {status.preset} · {status.chatModel}
      </Badge>
      {state && <Badge className={`h-5 rounded px-1.5 text-[10px] ${state.tone}`}>{state.label}</Badge>}
      {state && (
        <Button
          variant="ghost"
          size="xs"
          type="button"
          onClick={() => (progress ? abort.current?.abort() : void build())}
        >
          {progress ? `${progress} (cancelar)` : upToDate ? "Reindexar" : "Indexar"}
        </Button>
      )}
    </div>
  );
}
