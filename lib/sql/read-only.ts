// Trava de leitura: checagem léxica, sem parser. A mesma função roda no navegador (aviso antes de
// enviar) e na rota /api/sankhya/query (recusa). Sem imports, para rodar direto no Node.
//
// Limites conhecidos: recusa um SELECT que use uma palavra proibida como identificador sem aspas
// (contorno: aspas duplas) e não impede funções PL/SQL que escrevam chamadas dentro de um SELECT.

export type ReadOnlyCheck = { ok: true } | { ok: false; reason: string };

// UPDATE também cobre `FOR UPDATE`.
const FORBIDDEN = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "MERGE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "EXECUTE",
  "BEGIN",
  "DECLARE",
  "CALL",
  "LOCK",
];
const FORBIDDEN_RE = new RegExp(`(?<![A-Za-z0-9_$#])(${FORBIDDEN.join("|")})(?![A-Za-z0-9_$#])`, "i");
const LEADING_RE = /^(SELECT|WITH)(?![A-Za-z0-9_$#])/i;
const IDENT_CHAR = /[A-Za-z0-9_$#]/;
const Q_QUOTE = /^[nN]?[qQ]'/;
const Q_CLOSERS: Record<string, string> = { "[": "]", "(": ")", "{": "}", "<": ">" };

// Troca comentários por espaço e literais/identificadores entre aspas por marcadores neutros, para que
// `;` e palavras dentro deles não contem. Devolve null se algum ficar sem fechar.
export function stripLiterals(sql: string): string | null {
  let out = "";
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      out += " ";
      continue;
    }

    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      if (end === -1) return null;
      i = end + 2;
      out += " ";
      continue;
    }

    // q'[...]' e nq'[...]': o delimitador vem logo depois da aspa.
    const qQuote = i === 0 || !IDENT_CHAR.test(sql[i - 1]) ? Q_QUOTE.exec(sql.slice(i, i + 3)) : null;
    if (qQuote) {
      const open = sql[i + qQuote[0].length];
      if (open === undefined) return null;
      const end = sql.indexOf(`${Q_CLOSERS[open] ?? open}'`, i + qQuote[0].length + 1);
      if (end === -1) return null;
      i = end + 2;
      out += "''";
      continue;
    }

    if (ch === "'") {
      let j = i + 1;
      for (;;) {
        const end = sql.indexOf("'", j);
        if (end === -1) return null;
        if (sql[end + 1] === "'") {
          j = end + 2;
          continue;
        }
        i = end + 1;
        break;
      }
      out += "''";
      continue;
    }

    if (ch === '"') {
      const end = sql.indexOf('"', i + 1);
      if (end === -1) return null;
      i = end + 1;
      out += '"Q"';
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

export function checkReadOnly(sql: string): ReadOnlyCheck {
  const code = stripLiterals(sql);
  if (code === null) return { ok: false, reason: "Há uma aspa ou um comentário /* sem fechar." };

  const trimmed = code.trim();
  if (!trimmed) return { ok: false, reason: "O SQL está vazio." };
  if (!LEADING_RE.test(trimmed)) return { ok: false, reason: "Só é permitido SELECT ou WITH." };
  if (trimmed.includes(";")) return { ok: false, reason: "Envie uma única instrução, sem ';' (inclusive no final)." };

  const word = FORBIDDEN_RE.exec(trimmed);
  if (word) {
    return {
      ok: false,
      reason: `Palavra não permitida em modo leitura: ${word[1].toUpperCase()}. Se for um identificador, use aspas duplas.`,
    };
  }

  return { ok: true };
}
