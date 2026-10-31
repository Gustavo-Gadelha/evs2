import "server-only";

import type { ColumnInfo, Relation, TableDetail } from "@/lib/types";
import { checkReadOnly } from "@/lib/sql/read-only";
import { executeQuery } from "@/features/query/server/execute";
import { cacheOfActiveProfile, tableName } from "./dictionary";

// Detalhes de uma tabela: colunas com tipo, tamanho e domínio (TDDCAM + TDDOPC) e ligações com outras tabelas
// (TDDLIG liga instâncias de TDDINS; TDDLGC diz quais campos casam). Só SELECT; o nome da tabela é validado.
async function rows(sql: string): Promise<unknown[][]> {
  const check = checkReadOnly(sql);
  if (!check.ok) throw new Error(check.reason);
  return (await executeQuery(sql)).rows;
}

const text = (value: unknown) => String(value ?? "");

async function readColumns(name: string): Promise<ColumnInfo[]> {
  const [columns, options] = await Promise.all([
    rows(`SELECT NOMECAMPO, DESCRCAMPO, TIPCAMPO, TAMANHO FROM TDDCAM WHERE NOMETAB = '${name}' ORDER BY NOMECAMPO`),
    rows(
      `SELECT C.NOMECAMPO, O.VALOR, O.OPCAO FROM TDDOPC O JOIN TDDCAM C ON C.NUCAMPO = O.NUCAMPO ` +
        `WHERE C.NOMETAB = '${name}' ORDER BY C.NOMECAMPO, O.ORDEM, O.VALOR`,
    ),
  ]);

  const byColumn = new Map<string, ColumnInfo["options"]>();
  for (const [column, value, label] of options) {
    const list = byColumn.get(text(column)) ?? [];
    list.push({ value: text(value), label: text(label) });
    byColumn.set(text(column), list);
  }

  return columns
    .filter(([column]) => column)
    .map(([column, description, type, size]) => ({
      name: text(column),
      description: text(description),
      type: text(type),
      size: size === null || size === undefined || size === "" ? null : Number(size),
      options: byColumn.get(text(column)) ?? [],
    }));
}

// Uma linha por par de colunas; agrupa por ligação (instância de origem e de destino) e olha dos dois lados.
async function readRelations(name: string): Promise<Relation[]> {
  const found = await rows(
    `SELECT L.NUINSTORIG, L.NUINSTDEST, IO.NOMETAB, ID.NOMETAB, CO.NOMECAMPO, CD.NOMECAMPO ` +
      `FROM TDDLIG L ` +
      `JOIN TDDINS IO ON IO.NUINSTANCIA = L.NUINSTORIG ` +
      `JOIN TDDINS ID ON ID.NUINSTANCIA = L.NUINSTDEST ` +
      `JOIN TDDLGC G ON G.NUINSTORIG = L.NUINSTORIG AND G.NUINSTDEST = L.NUINSTDEST ` +
      `JOIN TDDCAM CO ON CO.NUCAMPO = G.NUCAMPOORIG ` +
      `JOIN TDDCAM CD ON CD.NUCAMPO = G.NUCAMPODEST ` +
      `WHERE L.LIBERADO = 'S' AND (IO.NOMETAB = '${name}' OR ID.NOMETAB = '${name}') ` +
      `ORDER BY IO.NOMETAB, ID.NOMETAB, G.ORDEM`,
  );

  const relations = new Map<string, Relation>();
  for (const [origInst, destInst, origTab, destTab, origCol, destCol] of found) {
    // Quando a tabela é o destino, inverte para que `column` seja sempre dela.
    const forward = text(origTab) === name;
    const other = text(forward ? destTab : origTab);
    const key = `${origInst}>${destInst}`;
    const relation = relations.get(key) ?? { table: other, pairs: [] };
    relation.pairs.push({
      column: text(forward ? origCol : destCol),
      otherColumn: text(forward ? destCol : origCol),
    });
    relations.set(key, relation);
  }
  return [...relations.values()];
}

export async function tableDetail(table: string): Promise<TableDetail> {
  const name = tableName(table);
  const cache = await cacheOfActiveProfile();
  const cached = cache.details.get(name);
  if (cached) return cached;

  const [columns, relations] = await Promise.all([readColumns(name), readRelations(name)]);
  const detail = { columns, relations };
  cache.details.set(name, detail);
  return detail;
}
