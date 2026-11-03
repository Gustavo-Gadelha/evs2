// Sankhya falso para verificar o assistente sem tocar no ERP real: `node scripts/fake-sankhya.mjs [porta]`
// (padrão 4010). Responde ao login e ao `DbExplorerSP.executeQuery` com um dicionário pequeno de fixture
// (TDDTAB/TDDCAM) e valida consultas como o Oracle faria, só pelos nomes: tabela ou coluna que não existe devolve
// `status: "0"` com um ORA-00942/ORA-00904. Nunca devolve linhas de dados. Cadastre um perfil com baseUrl
// http://127.0.0.1:<porta> (dentro de um container: http://host.docker.internal:<porta>).

import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 4010);
// Em container, HOST=0.0.0.0 para o app alcançá-lo pela rede do compose.
const HOST = process.env.HOST ?? "127.0.0.1";

const DICTIONARY = {
  TGFCAB: [
    "Cabeçalho da Nota",
    {
      NUNOTA: "Número único",
      NUMNOTA: "Número da nota",
      CODPARC: "Código do parceiro",
      CODVEND: "Código do vendedor",
      CODEMP: "Código da empresa",
      CODTIPOPER: "Código do tipo de operação",
      TIPMOV: "Tipo de movimento (V = venda, C = compra, P = pedido)",
      DTNEG: "Data de negociação",
      VLRNOTA: "Valor total da nota",
      STATUSNOTA: "Status da nota",
    },
  ],
  TGFITE: [
    "Itens da Nota",
    {
      NUNOTA: "Número único da nota",
      SEQUENCIA: "Sequência do item",
      CODPROD: "Código do produto",
      QTDNEG: "Quantidade negociada",
      VLRUNIT: "Valor unitário",
      VLRTOT: "Valor total do item",
    },
  ],
  TGFPAR: [
    "Parceiros (clientes e fornecedores)",
    {
      CODPARC: "Código do parceiro",
      NOMEPARC: "Nome do parceiro",
      CGC_CPF: "CNPJ ou CPF",
      TIPPESSOA: "Tipo de pessoa",
    },
  ],
  TGFVEN: ["Vendedores", { CODVEND: "Código do vendedor", APELIDO: "Nome do vendedor", ATIVO: "Ativo (S/N)" }],
  TGFPRO: [
    "Produtos",
    { CODPROD: "Código do produto", DESCRPROD: "Descrição do produto", ESTMIN: "Estoque mínimo", ATIVO: "Ativo (S/N)" },
  ],
  TGFEST: [
    "Estoque",
    { CODPROD: "Código do produto", CODEMP: "Código da empresa", CODLOCAL: "Local", ESTOQUE: "Quantidade em estoque" },
  ],
  TSIEMP: ["Empresas", { CODEMP: "Código da empresa", NOMEFANTASIA: "Nome fantasia", RAZAOSOCIAL: "Razão social" }],
  TGFTOP: ["Tipos de Operação", { CODTIPOPER: "Código do tipo de operação", DESCROPER: "Descrição da operação" }],
};

const KEYWORDS = new Set(
  `SELECT FROM WHERE AND OR NOT IN IS NULL AS ON JOIN INNER LEFT RIGHT FULL OUTER CROSS GROUP BY ORDER HAVING DISTINCT
  CASE WHEN THEN ELSE END ASC DESC FETCH FIRST NEXT ROWS ROW ONLY OFFSET ROWNUM WITH UNION ALL BETWEEN LIKE EXISTS
  SYSDATE DUAL SUM COUNT AVG MIN MAX NVL COALESCE TRUNC ADD_MONTHS TO_DATE TO_CHAR TO_NUMBER UPPER LOWER ROUND
  EXTRACT YEAR MONTH DAY MONTHS LAST_DAY MONTHS_BETWEEN SUBSTR LENGTH INSTR DECODE OVER PARTITION ROW_NUMBER RANK
  DENSE_RANK`.split(/\s+/),
);

// Erro do Oracle para o SQL, ou null se aceito. Só confere nomes de tabelas e colunas.
function validate(sql) {
  const inner = sql
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const tables = new Map(); // alias ou nome -> tabela
  const ctes = new Set([...inner.matchAll(/\b([A-Z_][A-Z0-9_$#]*)\s+AS\s*\(/gi)].map((m) => m[1].toUpperCase()));

  for (const m of inner.matchAll(
    /\b(?:FROM|JOIN)\s+([A-Z_][A-Z0-9_$#.]*)(?:\s+(?:AS\s+)?(?!(?:JOIN|INNER|LEFT|RIGHT|FULL|CROSS|ON|WHERE|GROUP|ORDER|HAVING|FETCH|UNION)\b)([A-Z_][A-Z0-9_$#]*))?/gi,
  )) {
    const table = m[1].toUpperCase().split(".").pop();
    if (ctes.has(table)) continue;
    if (table !== "DUAL" && !DICTIONARY[table]) return `ORA-00942: a tabela ou view ${table} não existe`;
    const alias = m[2]?.toUpperCase();
    tables.set(table, table);
    if (alias && !KEYWORDS.has(alias)) tables.set(alias, table);
  }

  const aliases = new Set([...inner.matchAll(/\bAS\s+"?([A-Z_][A-Z0-9_$#]*)"?/gi)].map((m) => m[1].toUpperCase()));
  const known = new Set([...tables.values()].flatMap((t) => (DICTIONARY[t] ? Object.keys(DICTIONARY[t][1]) : [])));

  for (const m of inner.matchAll(
    /(?<![\w"'$#.])(?:([A-Z_][A-Z0-9_$#]*)\.)?([A-Z_][A-Z0-9_$#]*)(?!\s*\()(?![\w$#])/gi,
  )) {
    const [, qualifier, name] = m;
    const upper = name.toUpperCase();
    if (KEYWORDS.has(upper) || DICTIONARY[upper] || tables.has(upper) || ctes.has(upper) || aliases.has(upper))
      continue;
    if (/^\d/.test(upper)) continue;
    if (qualifier) {
      const table = tables.get(qualifier.toUpperCase());
      if (!table) {
        if (ctes.has(qualifier.toUpperCase())) continue;
        return `ORA-00904: "${qualifier.toUpperCase()}"."${upper}": identificador inválido`;
      }
      if (!DICTIONARY[table]?.[1][upper])
        return `ORA-00904: "${qualifier.toUpperCase()}"."${upper}": identificador inválido`;
    } else if (!known.has(upper) && !(ctes.size > 0)) {
      return `ORA-00904: "${upper}": identificador inválido`;
    }
  }
  return null;
}

const rowsOf = (fields, rows) => ({
  status: "1",
  responseBody: { fieldsMetadata: fields.map((name, order) => ({ name, order })), rows },
});

function execute(sql) {
  const s = sql.trim().replace(/\s+/g, " ");
  if (/^SELECT NOMETAB, DESCRTAB FROM TDDTAB/i.test(s)) {
    return rowsOf(
      ["NOMETAB", "DESCRTAB"],
      Object.entries(DICTIONARY).map(([name, [description]]) => [name, description]),
    );
  }
  const cols = s.match(/^SELECT NOMECAMPO, DESCRCAMPO FROM TDDCAM WHERE NOMETAB = '([A-Z0-9_$#]+)'/i);
  if (cols) {
    const table = DICTIONARY[cols[1].toUpperCase()];
    return rowsOf(["NOMECAMPO", "DESCRCAMPO"], table ? Object.entries(table[1]) : []);
  }
  if (/^(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE)\b/i.test(s)) {
    return { status: "0", statusMessage: "A fake não executa escrita." };
  }
  const error = validate(sql);
  if (error) return { status: "0", statusMessage: error };
  return rowsOf(["OK"], []); // consulta aceita; a fake nunca devolve dados
}

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    const url = new URL(req.url ?? "/", "http://fake");
    const send = (status, json) => (
      res.writeHead(status, { "Content-Type": "application/json" }),
      res.end(JSON.stringify(json))
    );
    if (url.pathname.endsWith("/login")) return send(200, { bearerToken: "fake-token" });
    if (url.pathname.endsWith("/service.sbr")) {
      try {
        return send(200, execute(String(JSON.parse(body).requestBody?.sql ?? "")));
      } catch {
        return send(400, { status: "0", statusMessage: "Requisição inválida." });
      }
    }
    if (url.pathname.endsWith("/logout")) return send(200, {});
    send(404, {});
  });
}).listen(PORT, HOST, () => console.log(`fake-sankhya em http://${HOST}:${PORT}`));
