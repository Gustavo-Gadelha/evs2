"use client";

import { useMemo, useState } from "react";
import { LinkIcon, TableIcon } from "lucide-react";

import { normalize } from "../search";
import type { ColumnInfo, Relation, TableDetail } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_OPTIONS = 8;

function ColumnRow({ column }: { column: ColumnInfo }) {
  const shown = column.options.slice(0, MAX_OPTIONS);
  return (
    <li className="flex flex-col px-2 py-1">
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-xs text-foreground">{column.name}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {column.type}
          {column.size ? `(${column.size})` : ""}
        </span>
      </span>
      {column.description && <span className="text-xs text-muted-foreground">{column.description}</span>}
      {shown.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {shown.map((option) => `${option.value} = ${option.label}`).join(" · ")}
          {column.options.length > MAX_OPTIONS && ` · +${column.options.length - MAX_OPTIONS}`}
        </span>
      )}
    </li>
  );
}

function RelationRow({
  relation,
  canJoin,
  onOpen,
  onJoin,
}: {
  relation: Relation;
  canJoin: boolean;
  onOpen: () => void;
  onJoin: () => void;
}) {
  return (
    <li className="flex items-start gap-2 px-2 py-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <button type="button" className="w-fit font-mono text-xs text-foreground hover:underline" onClick={onOpen}>
          {relation.table}
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">
          {relation.pairs.map((pair) => `${pair.column} = ${pair.otherColumn}`).join(" AND ")}
        </span>
      </div>
      <Button
        variant="outline"
        size="xs"
        type="button"
        disabled={!canJoin}
        title={canJoin ? "Adiciona o JOIN ao builder" : "A tabela precisa estar no FROM ou num JOIN"}
        onClick={onJoin}
      >
        <LinkIcon data-icon="inline-start" />
        JOIN
      </Button>
    </li>
  );
}

// Colunas (tipo, tamanho, valores de domínio) e ligações da tabela escolhida, com as ações para o builder.
export function TableDetailPanel({
  table,
  detail,
  inQuery,
  onOpenTable,
  onPreview,
  onAddJoin,
}: {
  table: string;
  detail: TableDetail;
  inQuery: boolean;
  onOpenTable: (table: string) => void;
  onPreview: () => void;
  onAddJoin: (relation: Relation) => void;
}) {
  const [query, setQuery] = useState("");
  const columns = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return detail.columns;
    return detail.columns.filter((column) => normalize(`${column.name} ${column.description}`).includes(needle));
  }, [detail.columns, query]);

  return (
    <>
      <div className="flex items-center gap-2">
        <Input placeholder={`Buscar coluna em ${table}`} value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button variant="outline" size="sm" type="button" title="Monta um SELECT com 20 linhas no builder" onClick={onPreview}>
          <TableIcon data-icon="inline-start" />
          Ver 20 linhas
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <ul className="flex flex-col">
          {columns.map((column) => (
            <ColumnRow key={column.name} column={column} />
          ))}
          {columns.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">Nada encontrado.</li>}
        </ul>
        <h3 className="label mt-3 px-2">Relacionamentos ({detail.relations.length})</h3>
        <ul className="flex flex-col">
          {detail.relations.map((relation, index) => (
            <RelationRow
              key={`${relation.table}-${index}`}
              relation={relation}
              canJoin={inQuery}
              onOpen={() => onOpenTable(relation.table)}
              onJoin={() => onAddJoin(relation)}
            />
          ))}
          {detail.relations.length === 0 && (
            <li className="px-2 py-1 text-xs text-muted-foreground">Nenhuma ligação no dicionário.</li>
          )}
        </ul>
      </div>
    </>
  );
}
