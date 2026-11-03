// Validação sintática no Oracle sem trazer dados: `SELECT 1` em vez de `SELECT *` evita um falso ORA-00918 em
// consultas com colunas repetidas (a expansão do `*` as acusaria, mas a consulta original roda), e `ROWNUM <= 0`
// faz o Oracle analisar tabelas e colunas sem devolver nenhuma linha. A quebra de linha antes do `)` protege
// contra um comentário `--` na última linha do SQL.
export function wrapForValidation(sql: string): string {
  return `SELECT 1 FROM (\n${sql}\n) WHERE ROWNUM <= 0`;
}
