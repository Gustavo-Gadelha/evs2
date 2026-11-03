// Sankhya falso para verificar o assistente sem tocar no ERP real: `node scripts/fake-sankhya.mjs [porta]`
// (padrão 4010). Emite um token para qualquer combinação de credenciais não vazias (sem checar valores) e responde ao
// `DbExplorerSP.executeQuery` com o dicionário de fixture (TDDTAB/TDDCAM); valida consultas como o Oracle faria, só pelos nomes: tabela ou coluna que não existe devolve
// `status: "0"` com um ORA-00942/ORA-00904. Devolve linhas fictícias (scripts/fake-sankhya-data.mjs) executando o SELECT num SQLite em memória, só leitura. Cadastre um perfil com baseUrl
// http://127.0.0.1:<porta>. No compose roda como o serviço `sankhya-falso` (porta 8000): use http://sankhya-falso:8000.

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createDatabase, runQuery } from "./fake-sankhya-data.mjs";

const CREDENTIAL_HEADERS = ["appkey", "token", "username", "password"];
// Tokens emitidos pelo login; reiniciar o falso os invalida (o app refaz o login ao receber 401).
const tokens = new Set();

const PORT = Number(process.argv[2] ?? 4010);
// Em container, HOST=0.0.0.0 para o app alcançá-lo pela rede do compose.
const HOST = process.env.HOST ?? "127.0.0.1";

// Fixture em scripts/fake-sankhya-dictionary.json: { TABELA: { description, columns: { CAMPO: descrição } } }.
const DICTIONARY = loadDictionary();
const db = createDatabase(DICTIONARY);

function loadDictionary() {
  const file = new URL("./fake-sankhya-dictionary.json", import.meta.url);
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const dictionary = {};
  for (const [table, def] of Object.entries(raw)) {
    const ok = typeof def?.description === "string" && def.columns && typeof def.columns === "object";
    const names = [table, ...Object.keys(def?.columns ?? {})];
    if (!ok || names.some((n) => !/^[A-Z][A-Z0-9_$#]*$/.test(n)) || Object.values(def.columns).some((d) => typeof d !== "string"))
      throw new Error(`fake-sankhya-dictionary.json: definição inválida em ${table}`);
    dictionary[table] = [def.description, def.columns];
  }
  return dictionary;
}

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

  const aliases = new Set(
    [
      ...inner.matchAll(/\bAS\s+"?([A-Z_][A-Z0-9_$#]*)"?/gi),
      ...inner.matchAll(/\)\s+"?([A-Z_][A-Z0-9_$#]*)"?\s*(?:,|\bFROM\b)/gi), // alias sem AS depois de função
    ].map((m) => m[1].toUpperCase()),
  );
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
    return rowsOf(
      ["NOMECAMPO", "DESCRCAMPO"],
      table ? Object.entries(table[1]).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)) : [],
    );
  }
  if (/^(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE)\b/i.test(s)) {
    return { status: "0", statusMessage: "A fake não executa escrita." };
  }
  const error = validate(sql);
  if (error) return { status: "0", statusMessage: error };
  try {
    const { fields, rows } = runQuery(db, sql);
    return rowsOf(fields, rows);
  } catch (error) {
    // Sintaxe que o SQLite não entende (Oracle além do que a tradução cobre).
    return { status: "0", statusMessage: `ORA-00933: comando SQL não finalizado adequadamente (${error.message})` };
  }
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
    if (url.pathname.endsWith("/login")) {
      // Aceita qualquer combinação de credenciais, desde que as quatro venham preenchidas.
      if (CREDENTIAL_HEADERS.some((h) => !String(req.headers[h] ?? "").trim())) {
        return send(401, { error: "Credenciais ausentes: informe appkey, token, username e password." });
      }
      const bearerToken = `fake-${randomUUID()}`;
      tokens.add(bearerToken);
      return send(200, { bearerToken });
    }
    if (url.pathname.endsWith("/service.sbr")) {
      const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1] ?? "";
      if (url.searchParams.get("serviceName") === "MobileLoginSP.logout") {
        tokens.delete(bearer);
        return send(200, {});
      }
      if (!tokens.has(bearer)) {
        return send(401, { status: "0", statusMessage: "Não autenticado." });
      }
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
