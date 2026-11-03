// Extrai o SQL da resposta do modelo: bloco ```sql (o último, que é a versão final) ou, sem cercas, o texto
// a partir do primeiro SELECT/WITH. Descarta o raciocínio (<think>) e o `;` final.

export function stripThinking(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "");
}

export function cleanSql(sql: string): string {
  return sql.trim().replace(/[\s;]+$/, "");
}

export function extractSql(text: string): string | null {
  const body = stripThinking(text);

  const fenced = [...body.matchAll(/```(?:sql|oracle|plsql)?[ \t]*\r?\n([\s\S]*?)```/gi)].map((m) => cleanSql(m[1]));
  const candidates = fenced.filter(Boolean);
  if (candidates.length > 0) return candidates[candidates.length - 1];

  const start = body.search(/\b(select|with)\b/i);
  if (start < 0) return null;
  const sql = cleanSql(body.slice(start).replace(/```[\s\S]*$/, ""));
  return sql || null;
}
