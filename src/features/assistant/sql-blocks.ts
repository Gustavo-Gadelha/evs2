export type MessagePart = { kind: "text"; text: string } | { kind: "sql"; code: string; open: boolean };

// Separa a resposta em texto e blocos ```sql. Um bloco ainda sem o fecho (resposta em streaming) vem com `open`.
export function splitMessage(content: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const fence = /```[ \t]*(?:sql)?[ \t]*\r?\n([\s\S]*?)(?:\r?\n```|$)/gi;
  let last = 0;
  for (const match of content.matchAll(fence)) {
    const before = content.slice(last, match.index);
    if (before.trim()) parts.push({ kind: "text", text: before.trim() });
    const closed = match[0].endsWith("```");
    parts.push({ kind: "sql", code: match[1], open: !closed });
    last = match.index + match[0].length;
  }
  const rest = content.slice(last);
  if (rest.trim()) parts.push({ kind: "text", text: rest.trim() });
  return parts;
}
