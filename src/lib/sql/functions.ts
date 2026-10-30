// Modelos do menu ƒ dos campos de expressão. `{x}` recebe o texto selecionado no campo, ou "x".

export type SqlFunction = { label: string; template: string };

export const ORACLE_FUNCTIONS: SqlFunction[] = [
  { label: "NVL: troca NULL", template: "NVL({x}, 0)" },
  { label: "COALESCE: primeiro não nulo", template: "COALESCE({x}, 0)" },
  { label: "DECODE: mapa de valores", template: "DECODE({x}, 'A', 'Valor A', 'Outro')" },
  { label: "CASE WHEN", template: "CASE WHEN {x} THEN 'S' ELSE 'N' END" },
  { label: "TRUNC: data sem hora", template: "TRUNC({x})" },
  { label: "TO_CHAR: data formatada", template: "TO_CHAR({x}, 'DD/MM/YYYY')" },
  { label: "TO_DATE", template: "TO_DATE({x}, 'DD/MM/YYYY')" },
  { label: "EXTRACT: ano", template: "EXTRACT(YEAR FROM {x})" },
  { label: "SUBSTR", template: "SUBSTR({x}, 1, 10)" },
  { label: "UPPER", template: "UPPER({x})" },
  { label: "SYSDATE", template: "SYSDATE" },
  { label: "ADD_MONTHS", template: "ADD_MONTHS({x}, 1)" },
];

export function applyTemplate(template: string, selection: string): string {
  return template.replaceAll("{x}", selection || "x");
}
