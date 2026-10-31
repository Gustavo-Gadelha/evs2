// Formata SQL Oracle (PL/SQL) com o sql-formatter. Devolve null quando não há o que mudar ou quando o
// texto não pode ser formatado (aspas sem fechar, sintaxe que o formatador não entende).
// Só `import type` entre os arquivos de `lib/sql/`; o sql-formatter é o único import em runtime.

import { formatDialect, plsql } from "sql-formatter";

export function formatSql(sql: string): string | null {
  if (!sql.trim()) return null;
  try {
    const formatted = formatDialect(sql, { dialect: plsql, keywordCase: "upper", tabWidth: 2 });
    return formatted === sql ? null : formatted;
  } catch {
    return null;
  }
}

// O formatador só mexe em espaços e na caixa das palavras-chave: a posição do cursor é a mesma
// contando só os caracteres que não são espaço.
export function mapCursor(before: string, cursor: number, after: string): number {
  let target = before.slice(0, cursor).replace(/\s/g, "").length;
  if (target === 0) return 0;
  for (let i = 0; i < after.length; i++) {
    if (!/\s/.test(after[i]) && --target === 0) return i + 1;
  }
  return after.length;
}
