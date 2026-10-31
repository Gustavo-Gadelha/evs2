"use client";

import { useMemo, useState } from "react";

import type { QueryResult } from "@/lib/types";
import { ResultTable, cellText } from "./result-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

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
  const json = useMemo(() => (result && view === "json" ? JSON.stringify(result.raw, null, 2) : ""), [result, view]);

  if (error) {
    return (
      <Alert variant="destructive" className="border-destructive/40 bg-destructive/10 p-4">
        <AlertTitle className="label text-destructive">Erro</AlertTitle>
        <AlertDescription>
          <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs text-destructive">{error}</pre>
        </AlertDescription>
      </Alert>
    );
  }

  if (!result) {
    return (
      <Card size="sm">
        <CardContent className="text-muted-foreground">
          O resultado aparece aqui. Monte a consulta e pressione Ctrl+Enter.
      </CardContent>
      </Card>
    );
  }

  const { rows } = result;

  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(toCsv(result!));
      toast.success("CSV copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <Card size="sm" className="min-w-0">
        <CardContent className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <Badge className="bg-emerald-500/15 text-emerald-300">{rows.length} linha(s)</Badge>
          <span className="text-muted-foreground">{result.durationMs} ms</span>
          <div className="ml-auto flex items-center gap-2">
            <Tabs value={view} onValueChange={(value) => setView(value as "table" | "json")}>
              <TabsList>
                <TabsTrigger value="table">Tabela</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="ghost" size="xs" type="button" onClick={copyCsv}>
              Copiar CSV
            </Button>
          </div>
        </div>

        {view === "json" ? (
          <pre className="max-h-[60vh] overflow-auto rounded border border-border bg-background p-3 font-mono text-xs leading-relaxed">
            {json}
          </pre>
        ) : (
          <ResultTable key={tableKey(result)} result={result} />
        )}
      </CardContent>
    </Card>
  );
}
