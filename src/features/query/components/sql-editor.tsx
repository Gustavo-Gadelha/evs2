"use client";

import { useState } from "react";

import { checkReadOnly } from "@/lib/sql/read-only";
import { SaveForm } from "@/features/history/components/save-form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  sql: string;
  manual: boolean;
  running: boolean;
  canRegenerate: boolean;
  onChange: (sql: string) => void;
  onRegenerate: () => void;
  onRun: () => void;
  onSave: (name: string) => void;
};

export function SqlEditor({ sql, manual, running, canRegenerate, onChange, onRegenerate, onRun, onSave }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const check = checkReadOnly(sql);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard indisponível.
    }
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label">SQL</span>
          <Badge
            className={`h-4 rounded px-1.5 text-[10px] uppercase ${manual ? "bg-amber-500/15 text-amber-300" : "bg-sky-500/15 text-sky-300"}`}
          >
            {manual ? "editado à mão" : "gerado pelo builder"}
          </Badge>
          {manual &&
            (confirming ? (
              <span className="flex items-center gap-1 text-xs text-zinc-300">
                Descartar a edição?
                <Button
                  variant="outline" size="sm"
                  type="button"
                  disabled={!canRegenerate}
                  title={canRegenerate ? undefined : "Corrija os problemas do builder primeiro"}
                  onClick={() => {
                    setConfirming(false);
                    onRegenerate();
                  }}
                >
                  Sim, regenerar
                </Button>
                <Button variant="ghost" size="xs" type="button" onClick={() => setConfirming(false)}>
                  Cancelar
                </Button>
              </span>
            ) : (
              <Button variant="ghost" size="xs" type="button" onClick={() => setConfirming(true)}>
                ↺ regenerar do builder
              </Button>
            ))}
          <div className="ml-auto flex items-center gap-2">
            <SaveForm label="Salvar consulta" onSave={onSave} />
            <Button variant="ghost" size="xs" type="button" disabled={!sql} onClick={copy}>
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button size="default" type="button" disabled={running || !check.ok} onClick={onRun}>
              {running ? "Rodando…" : "Rodar"}
              <kbd className="ml-2 hidden text-[10px] opacity-70 sm:inline">Ctrl+Enter</kbd>
            </Button>
          </div>
        </div>
        <Textarea
          aria-label="SQL"
          spellCheck={false}
          className="min-h-64 resize-y font-mono text-xs leading-relaxed"
          placeholder="Monte a consulta no builder ou escreva o SQL aqui."
          value={sql}
          onChange={(event) => onChange(event.target.value)}
        />
        {sql && !check.ok && <p className="text-xs text-amber-300">{check.reason}</p>}
      </CardContent>
    </Card>
  );
}
