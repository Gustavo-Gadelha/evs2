"use client";

import { useMemo, useState } from "react";

import type { QueryResult } from "@/lib/types";
import { ResultTable, cellText } from "./result-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Cada resultado ganha uma tabela nova, sem herdar filtros e ordenação do anterior.
const tableKeys = new WeakMap<QueryResult, number>();
let nextTableKey = 0;
function tableKey(result: QueryResult): number {
  if (!tableKeys.has(result)) tableKeys.set(result, nextTableKey++);
  return tableKeys.get(result)!;
}

function csvField(value: unknown): string {
  const text = cellText(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv({ columns, rows }: QueryResult): string {
  const lines = [columns.map(csvField), ...rows.map((row) => columns.map((_, index) => csvField(row[index])))];
  return lines.map((line) => line.join(",")).join("\n");
}

type Props = { result: QueryResult | null; error: string | null };

export function ResultView({ result, error }: Props) {
  const [view, setView] = useState<"table" | "json">("table");
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => (result && view === "json" ? JSON.stringify(result.raw, null, 2) : ""), [result, view]);

  if (error) {
    return (
      <Alert variant="destructive" className="border-red-900 bg-red-950/40 p-4">
        <AlertTitle className="label text-red-300">Erro</AlertTitle>
        <AlertDescription>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-red-200">{error}</pre>
        </AlertDescription>
      </Alert>
    );
  }

  if (!result) {
    return (
      <section className="panel text-sm text-zinc-500">
        O resultado aparece aqui. Monte a consulta e pressione Ctrl+Enter.
      </section>
    );
  }

  const { rows } = result;

  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(toCsv(result!));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard indisponível.
    }
  }

  return (
    <section className="panel flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Badge className="bg-emerald-500/15 text-emerald-300">{rows.length} linha(s)</Badge>
        <span className="text-zinc-400">{result.durationMs} ms</span>
        <div className="ml-auto flex items-center gap-2">
          <Tabs value={view} onValueChange={(value) => setView(value as "table" | "json")}>
            <TabsList>
              <TabsTrigger value="table">Tabela</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="xs" type="button" onClick={copyCsv}>
            {copied ? "Copiado" : "Copiar CSV"}
          </Button>
        </div>
      </div>

      {view === "json" ? (
        <pre className="max-h-[60vh] overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-relaxed">
          {json}
        </pre>
      ) : (
        <ResultTable key={tableKey(result)} result={result} />
      )}
    </section>
  );
}
