"use client";

import { useMemo, useRef } from "react";
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type FilterFn,
  type SortFn,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { QueryResult } from "@/lib/types";

type ResultRow = unknown[];

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
});
const helper = createColumnHelper<typeof features, ResultRow>();

const ROW_HEIGHT = 28;
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

// Busca sem diferenciar maiúsculas nem acentos: "sao" encontra "São".
function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

const includesText: FilterFn<typeof features, ResultRow> = Object.assign(
  (row: Parameters<FilterFn<typeof features, ResultRow>>[0], columnId: string, filterValue: string) =>
    normalize(cellText(row.getValue(columnId))).includes(filterValue),
  { resolveFilterValue: (value: unknown) => normalize(String(value ?? "")) },
);

// Números como número, texto em ordem natural pt-BR ("9" antes de "10"); nulos por último no ASC.
const compareValues: SortFn<typeof features, ResultRow> = (a, b, columnId) => {
  const x = a.getValue(columnId);
  const y = b.getValue(columnId);
  if (x === null || x === undefined || y === null || y === undefined) {
    return (x === null || x === undefined ? 1 : 0) - (y === null || y === undefined ? 1 : 0);
  }
  if (typeof x === "number" && typeof y === "number") return x - y;
  return collator.compare(cellText(x), cellText(y));
};

// Largura pelo conteúdo (cabeçalho e primeiras linhas), limitada para colunas longas não dominarem.
function columnWidths({ columns, rows }: QueryResult): number[] {
  const sample = rows.slice(0, 200);
  return columns.map((name, index) => {
    const longest = sample.reduce<number>((max, row) => Math.max(max, cellText(row[index]).length), name.length + 2);
    return Math.min(420, Math.max(72, longest * 7.2 + 20));
  });
}

export function ResultTable({ result }: { result: QueryResult }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () =>
      helper.columns(
        result.columns.map((name, index) =>
          helper.accessor((row) => row[index], {
            id: `c${index}`,
            header: name,
            sortFn: compareValues,
            filterFn: includesText,
          }),
        ),
      ),
    [result.columns],
  );
  const widths = useMemo(() => columnWidths(result), [result]);

  const table = useTable({
    features,
    columns,
    data: result.rows,
    globalFilterFn: includesText,
    // Por padrão só entram colunas cujo valor na 1ª linha é texto ou número; aqui todas entram.
    getColumnCanGlobalFilter: () => true,
    sortDescFirst: false,
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index].id,
    overscan: 12,
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const widthOf = (columnId: string) => widths[Number(columnId.slice(1))];
  const numberWidth = String(result.rows.length).length * 7.2 + 20;
  const totalWidth = numberWidth + visibleColumns.reduce((sum, column) => sum + widthOf(column.id), 0);
  const filtered = rows.length !== result.rows.length;
  const hasFilters = Boolean(table.state.globalFilter) || table.state.columnFilters.length > 0;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          aria-label="Buscar em todas as colunas"
          className="input w-56"
          placeholder="Buscar em todas as colunas"
          value={table.state.globalFilter ?? ""}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
        />
        {hasFilters && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              table.setGlobalFilter("");
              table.resetColumnFilters(true);
            }}
          >
            limpar filtros
          </button>
        )}
        {filtered && (
          <span className="text-zinc-400">
            {rows.length} de {result.rows.length} linha(s)
          </span>
        )}
        <details className="relative ml-auto">
          <summary className="btn-ghost cursor-pointer select-none list-none">
            Colunas ({visibleColumns.length}/{result.columns.length})
          </summary>
          <div className="absolute right-0 z-20 mt-1 flex max-h-72 w-60 flex-col gap-1 overflow-auto rounded border border-zinc-700 bg-zinc-900 p-2 shadow-lg">
            <button type="button" className="btn-ghost self-start" onClick={() => table.toggleAllColumnsVisible(true)}>
              mostrar todas
            </button>
            {table.getAllLeafColumns().map((column) => (
              <label key={column.id} className="flex items-center gap-2 font-mono text-zinc-300">
                <input
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={(event) => column.toggleVisibility(event.target.checked)}
                />
                <span className="truncate">{result.columns[Number(column.id.slice(1))]}</span>
              </label>
            ))}
          </div>
        </details>
      </div>

      <div ref={scrollRef} className="max-h-[60vh] overflow-auto rounded border border-zinc-800">
        <table className="grid font-mono text-xs" style={{ width: totalWidth }}>
          <thead className="sticky top-0 z-10 grid bg-zinc-900">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="flex">
                <th className="shrink-0 border-b border-zinc-800 px-2 py-1.5 text-right text-zinc-500" style={{ width: numberWidth }}>
                  #
                </th>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="shrink-0 border-b border-zinc-800 px-2 py-1.5 text-left font-semibold text-zinc-300"
                      style={{ width: widthOf(header.column.id) }}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-1 text-left hover:text-zinc-50"
                        title="Ordenar"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="truncate">
                          <table.FlexRender header={header} />
                        </span>
                        <span className="text-sky-400">{sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : ""}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            ))}
            <tr className="flex">
              <th className="shrink-0 border-b border-zinc-800" style={{ width: numberWidth }} />
              {visibleColumns.map((column) => (
                <th key={column.id} className="shrink-0 border-b border-zinc-800 p-1" style={{ width: widthOf(column.id) }}>
                  <input
                    aria-label={`Filtrar ${result.columns[Number(column.id.slice(1))]}`}
                    className="input w-full px-1.5 py-0.5 text-xs font-normal"
                    placeholder="filtrar"
                    value={(column.getFilterValue() as string | undefined) ?? ""}
                    onChange={(event) => column.setFilterValue(event.target.value)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="relative grid" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              return (
                <tr
                  key={row.id}
                  className={`absolute flex w-full hover:bg-zinc-800/60 ${item.index % 2 ? "" : "bg-zinc-900/40"}`}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${item.start}px)` }}
                >
                  <td className="shrink-0 px-2 text-right leading-7 text-zinc-500" style={{ width: numberWidth }}>
                    {item.index + 1}
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const text = cellText(cell.getValue());
                    return (
                      <td
                        key={cell.id}
                        className="shrink-0 truncate whitespace-nowrap px-2 leading-7"
                        style={{ width: widthOf(cell.column.id) }}
                        title={text}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-2 py-3 text-xs text-zinc-500">
            {result.rows.length === 0 ? "A consulta não retornou linhas." : "Nenhuma linha corresponde aos filtros."}
          </p>
        )}
      </div>
    </div>
  );
}
