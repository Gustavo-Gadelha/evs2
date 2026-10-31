// Acrescenta ao QueryState um JOIN vindo de uma ligação do dicionário. Função pura.
// Só `import type`, para que `lib/sql/` rode direto no Node nas verificações.

import type { QueryState } from "@/lib/sql/query-state";
import type { Relation } from "@/lib/types";

const bare = (table: string) => table.trim().toUpperCase().split(".").pop() ?? "";

// Prefixo (alias ou nome) com que a tabela aparece no FROM ou num JOIN ativo; null se ela não está na consulta.
export function prefixOf(state: QueryState, table: string): string | null {
  const name = bare(table);
  const refs = [state.from, ...state.joins.filter((join) => !join.off)];
  const ref = refs.find((item) => bare(item.table) === name);
  return ref ? ref.alias.trim().toUpperCase() || name : null;
}

// `table` precisa estar na consulta; o novo JOIN ganha alias só se a outra tabela já aparece (ex.: TGFPAR2).
export function addRelationJoin(state: QueryState, table: string, relation: Relation): QueryState | null {
  const mine = prefixOf(state, table);
  if (mine === null || relation.pairs.length === 0) return null;

  const other = bare(relation.table);
  let alias = "";
  if (prefixOf(state, other) !== null) {
    const used = new Set([state.from, ...state.joins].map((ref) => ref.alias.trim().toUpperCase()));
    for (let n = 2; ; n++) {
      alias = `${other}${n}`;
      if (!used.has(alias)) break;
    }
  }
  const side = alias || other;

  return {
    ...state,
    joins: [
      ...state.joins,
      {
        type: "INNER",
        table: other,
        alias,
        on: {
          op: "AND",
          items: relation.pairs.map((pair) => ({
            left: `${mine}.${pair.column}`,
            op: "=" as const,
            right: { kind: "expr" as const, value: `${side}.${pair.otherColumn}` },
          })),
        },
      },
    ],
  };
}
