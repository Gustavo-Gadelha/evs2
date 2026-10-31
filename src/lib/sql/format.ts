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
