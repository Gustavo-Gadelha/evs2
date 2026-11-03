// Linhas fictícias do Sankhya falso, geradas de forma determinística (mesma semente = mesmos dados) e carregadas em
// um SQLite em memória (`node:sqlite`) que responde às consultas. Nada aqui é dado real: nomes, documentos e valores
// são inventados. Datas são texto ISO (AAAA-MM-DD). Tabelas sem gerador ficam vazias.

import { DatabaseSync } from "node:sqlite";

// PRNG mulberry32: determinístico, sem dependências.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = prng(20260101);
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (list) => list[int(0, list.length - 1)];
const money = (min, max) => Math.round((min + rand() * (max - min)) * 100) / 100;
const pad = (n, size) => String(n).padStart(size, "0");
const digits = (size) => Array.from({ length: size }, () => int(0, 9)).join("");
const addDays = (iso, days) => new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10);
const START = "2025-01-01";
const randomDate = (span = 670) => addDays(START, int(0, span));

const GIVEN = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Hugo", "Isabela", "João", "Karen"];
const FAMILY = ["Almeida", "Barros", "Cardoso", "Dias", "Esteves", "Farias", "Guimarães", "Lopes", "Moura", "Nunes"];
const BUSINESS = ["Comercial", "Distribuidora", "Mercantil", "Atacado", "Supermercado", "Indústria", "Armazém"];
const PRODUCTS = [
  ["Arroz tipo 1 5kg", "Alimentos"],
  ["Feijão carioca 1kg", "Alimentos"],
  ["Óleo de soja 900ml", "Alimentos"],
  ["Açúcar refinado 1kg", "Alimentos"],
  ["Café torrado 500g", "Alimentos"],
  ["Macarrão espaguete 500g", "Alimentos"],
  ["Refrigerante cola 2L", "Bebidas"],
  ["Água mineral 1,5L", "Bebidas"],
  ["Suco de laranja 1L", "Bebidas"],
  ["Cerveja lata 350ml", "Bebidas"],
  ["Detergente 500ml", "Limpeza"],
  ["Sabão em pó 1kg", "Limpeza"],
  ["Desinfetante 2L", "Limpeza"],
  ["Papel higiênico 12 rolos", "Higiene"],
  ["Sabonete 90g", "Higiene"],
  ["Shampoo 350ml", "Higiene"],
];
const CITIES = [
  ["São Paulo", "SP"],
  ["Campinas", "SP"],
  ["Rio de Janeiro", "RJ"],
  ["Belo Horizonte", "MG"],
  ["Curitiba", "PR"],
  ["Salvador", "BA"],
  ["Fortaleza", "CE"],
  ["Porto Alegre", "RS"],
];
const UFS = [
  ["SP", "São Paulo", 3],
  ["RJ", "Rio de Janeiro", 3],
  ["MG", "Minas Gerais", 3],
  ["PR", "Paraná", 4],
  ["RS", "Rio Grande do Sul", 4],
  ["BA", "Bahia", 2],
  ["CE", "Ceará", 2],
];
const REGIONS = [
  [1, "Norte"],
  [2, "Nordeste"],
  [3, "Sudeste"],
  [4, "Sul"],
  [5, "Centro-Oeste"],
];

function build() {
  const data = {};
  data.TSIREG = REGIONS.map(([CODREG, NOMEREG]) => ({ CODREG, NOMEREG }));
  data.TSIUFS = UFS.map(([UF, DESCRICAO], i) => ({ CODUF: i + 1, UF, DESCRICAO }));
  data.TSICID = CITIES.map(([NOMECID, uf], i) => {
    const [, , CODREG] = UFS.find(([sigla]) => sigla === uf);
    return { CODCID: i + 1, NOMECID, UF: UFS.findIndex(([sigla]) => sigla === uf) + 1, CODREG };
  });
  data.TSIBAI = CITIES.flatMap((_, c) =>
    ["Centro", "Jardim América", "Vila Nova"].map((NOMEBAI, b) => ({ CODBAI: c * 3 + b + 1, NOMEBAI, CODCID: c + 1 })),
  );

  data.TSIEMP = ["Matriz", "Filial Sul", "Filial Nordeste"].map((nome, i) => ({
    CODEMP: i + 1,
    NOMEFANTASIA: `Isis ${nome}`,
    RAZAOSOCIAL: `Isis Alimentos ${nome} Ltda`,
    CGC: `${digits(8)}000${i + 1}${digits(2)}`,
    CODCID: i + 1,
  }));

  data.TSIBCO = [
    [1, "Banco Exemplo", "EXM"],
    [237, "Banco Modelo", "MOD"],
    [341, "Banco Teste", "TST"],
  ].map(([CODBCO, NOMEBCO, ABREVIATURA]) => ({ CODBCO, NOMEBCO, ABREVIATURA }));
  data.TSICTA = data.TSIEMP.map((e, i) => ({
    CODCTABCOINT: i + 1,
    DESCRICAO: `Conta ${e.NOMEFANTASIA}`,
    CODBCO: data.TSIBCO[i % 3].CODBCO,
    CODEMP: e.CODEMP,
    AGENCIA: pad(int(1, 9999), 4),
    NUMCONTA: `${int(10000, 99999)}-${int(0, 9)}`,
  }));
  data.TSINAT = [
    [1010000, "Receitas", null, "N"],
    [1010100, "Venda de mercadorias", 1010000, "S"],
    [2010000, "Despesas", null, "N"],
    [2010100, "Compra de mercadorias", 2010000, "S"],
    [2010200, "Despesas administrativas", 2010000, "S"],
  ].map(([CODNAT, DESCRNAT, CODNATPAI, ANALITICA]) => ({ CODNAT, DESCRNAT, CODNATPAI, ANALITICA }));
  data.TSICUS = [
    [101, "Comercial"],
    [102, "Logística"],
    [103, "Administrativo"],
  ].map(([CODCENCUS, DESCRCENCUS]) => ({ CODCENCUS, DESCRCENCUS, ATIVO: "S" }));

  data.TGFTOP = [
    [1100, "Venda de mercadorias", "V", "B", "S"],
    [1101, "Venda a prazo", "V", "B", "S"],
    [1200, "Devolução de venda", "D", "E", "S"],
    [1300, "Compra de mercadorias", "C", "E", "S"],
    [1400, "Pedido de venda", "P", "N", "N"],
    [1500, "Transferência entre empresas", "T", "B", "N"],
  ].map(([CODTIPOPER, DESCROPER, TIPMOV, ATUALEST, ATUALFIN]) => ({ CODTIPOPER, DESCROPER, TIPMOV, ATUALEST, ATUALFIN }));
  data.TGFTPV = [
    [1, "À vista", 0],
    [2, "30 dias", 1.5],
    [3, "30/60 dias", 2.5],
    [4, "Cartão de crédito", 3.2],
  ].map(([CODTIPVENDA, DESCRTIPVENDA, TAXAJURO]) => ({ CODTIPVENDA, DESCRTIPVENDA, TAXAJURO, ATIVO: "S" }));
  data.TGFLOC = data.TSIEMP.map((e) => ({
    CODLOCAL: e.CODEMP * 10,
    DESCRLOCAL: `Depósito ${e.NOMEFANTASIA}`,
    CODEMP: e.CODEMP,
    ATIVO: "S",
  }));

  const groups = [...new Set(PRODUCTS.map(([, g]) => g))];
  data.TGFGRU = groups.map((DESCRGRUPOPROD, i) => ({
    CODGRUPOPROD: (i + 1) * 100,
    DESCRGRUPOPROD,
    CODGRUPAI: null,
    ANALITICO: "S",
  }));
  data.TGFMAR = ["Casa Nova", "Bom Gosto", "Doce Lar", "Sabor Real"].map((DESCRICAO, i) => ({
    CODIGO: i + 1,
    DESCRICAO,
  }));
  data.TGFPRO = PRODUCTS.map(([DESCRPROD, grupo], i) => ({
    CODPROD: 1000 + i,
    DESCRPROD,
    ESTMIN: int(10, 50),
    ATIVO: i % 11 === 10 ? "N" : "S",
    CODGRUPOPROD: (groups.indexOf(grupo) + 1) * 100,
    CODVOL: pick(["UN", "CX", "KG"]),
    MARCA: pick(data.TGFMAR).DESCRICAO,
    PESOBRUTO: money(0.3, 6),
  }));
  data.TGFCUS = data.TGFPRO.map((p) => {
    const CUSMED = money(2, 40);
    return {
      CODPROD: p.CODPROD,
      CODEMP: 1,
      DTATUAL: randomDate(),
      CUSMED,
      CUSREP: Math.round(CUSMED * 1.05 * 100) / 100,
      CUSSEMICM: Math.round(CUSMED * 0.88 * 100) / 100,
    };
  });
  data.TGFEST = data.TSIEMP.flatMap((e) =>
    data.TGFPRO.map((p) => {
      const ESTOQUE = int(0, 400);
      return {
        CODPROD: p.CODPROD,
        CODEMP: e.CODEMP,
        CODLOCAL: e.CODEMP * 10,
        ESTOQUE,
        RESERVADO: int(0, Math.min(ESTOQUE, 30)),
        DTATUAL: randomDate(),
      };
    }),
  );

  data.TGFVEN = Array.from({ length: 8 }, (_, i) => ({
    CODVEND: i + 1,
    APELIDO: `${pick(GIVEN)} ${pick(FAMILY)}`,
    ATIVO: i === 7 ? "N" : "S",
    CODGER: i < 2 ? null : i % 2 === 0 ? 1 : 2,
    COMVENDA: pick([1, 1.5, 2, 2.5, 3]),
  }));
  data.TSIUSU = data.TGFVEN.map((v, i) => ({
    CODUSU: i + 1,
    NOMEUSU: v.APELIDO.toUpperCase().replace(/[^A-Z]+/g, "."),
    CODVEND: v.CODVEND,
    CODEMP: 1 + (i % 3),
    DTLIMACESSO: i === 7 ? "2025-06-30" : null,
  }));

  data.TGFPAR = Array.from({ length: 60 }, (_, i) => {
    const pj = i % 3 !== 0;
    const fornecedor = i % 7 === 0;
    return {
      CODPARC: 100 + i,
      NOMEPARC: pj ? `${pick(BUSINESS)} ${pick(FAMILY)} Ltda` : `${pick(GIVEN)} ${pick(FAMILY)}`,
      CGC_CPF: pj ? digits(14) : digits(11),
      TIPPESSOA: pj ? "J" : "F",
      CODCID: int(1, CITIES.length),
      CODVEND: int(1, 7),
      CLIENTE: fornecedor ? "N" : "S",
      FORNECEDOR: fornecedor ? "S" : "N",
      ATIVO: i % 13 === 12 ? "N" : "S",
    };
  });
  data.TGFCPL = data.TGFPAR.filter((p) => p.CLIENTE === "S").map((p) => ({
    CODPARC: p.CODPARC,
    LIMCRED: pick([2000, 5000, 10000, 25000]),
    SUGTIPNEGSAID: int(1, 4),
    DTCAD: randomDate(300),
  }));

  data.TGFCAB = [];
  data.TGFITE = [];
  data.TGFDIN = [];
  data.TGFFIN = [];
  const clientes = data.TGFPAR.filter((p) => p.CLIENTE === "S");
  const fornecedores = data.TGFPAR.filter((p) => p.FORNECEDOR === "S");
  for (let n = 0; n < 400; n++) {
    const NUNOTA = 5000 + n;
    const compra = n % 8 === 0;
    const top = compra ? 1300 : pick([1100, 1100, 1101, 1400]);
    const TIPMOV = data.TGFTOP.find((t) => t.CODTIPOPER === top).TIPMOV;
    const parceiro = compra ? pick(fornecedores) : pick(clientes);
    const DTNEG = randomDate();
    let VLRNOTA = 0;
    const lines = int(1, 5);
    for (let s = 1; s <= lines; s++) {
      const QTDNEG = int(1, 40);
      const VLRUNIT = money(3, 60);
      const VLRTOT = Math.round(QTDNEG * VLRUNIT * 100) / 100;
      VLRNOTA += VLRTOT;
      data.TGFITE.push({ NUNOTA, SEQUENCIA: s, CODPROD: pick(data.TGFPRO).CODPROD, QTDNEG, VLRUNIT, VLRTOT });
      data.TGFDIN.push({
        NUNOTA,
        SEQUENCIA: s,
        CODIMP: 1,
        BASE: VLRTOT,
        ALIQUOTA: 18,
        VALOR: Math.round(VLRTOT * 0.18 * 100) / 100,
      });
    }
    VLRNOTA = Math.round(VLRNOTA * 100) / 100;
    const CODEMP = int(1, 3);
    data.TGFCAB.push({
      NUNOTA,
      NUMNOTA: 1000 + n,
      CODPARC: parceiro.CODPARC,
      CODVEND: compra ? 0 : parceiro.CODVEND,
      CODEMP,
      CODTIPOPER: top,
      TIPMOV,
      DTNEG,
      VLRNOTA,
      STATUSNOTA: pick(["L", "L", "L", "P", "A"]),
    });
    if (top !== 1400) {
      const parcelas = top === 1101 ? 2 : 1;
      for (let p = 0; p < parcelas; p++) {
        const DTVENC = addDays(DTNEG, 30 * (p + 1));
        const paga = DTVENC < "2026-08-01" && rand() > 0.15;
        const VLRDESDOB = Math.round((VLRNOTA / parcelas) * 100) / 100;
        data.TGFFIN.push({
          NUFIN: data.TGFFIN.length + 1,
          NUNOTA,
          CODEMP,
          CODPARC: parceiro.CODPARC,
          DTNEG,
          DTVENC,
          DHBAIXA: paga ? `${addDays(DTVENC, int(-3, 8))} 10:00:00` : null,
          VLRDESDOB,
          VLRBAIXA: paga ? VLRDESDOB : 0,
          RECDESP: compra ? -1 : 1,
          CODNAT: compra ? 2010100 : 1010100,
          CODBCO: pick(data.TSIBCO).CODBCO,
        });
      }
    }
  }

  data.TSIPAR = [
    ["CASASDECIMAIS", "Casas decimais de valores", "I", 2, null],
    ["NOMEEMPRESA", "Nome exibido nos relatórios", "S", null, "Isis Alimentos"],
    ["DIASVENCPADRAO", "Dias de vencimento padrão", "I", 30, null],
  ].map(([CHAVE, DESCRICAO, TIPO, INTEIRO, TEXTO]) => ({ CHAVE, DESCRICAO, TIPO, INTEIRO, TEXTO }));

  return data;
}

// Cria o SQLite em memória com as tabelas do dicionário e as linhas geradas; depois o deixa só para leitura.
export function createDatabase(dictionary) {
  const db = new DatabaseSync(":memory:");
  const rows = build();
  // TDDTAB e TDDCAM saem do próprio dicionário, para nunca divergirem dele.
  rows.TDDTAB = Object.entries(dictionary).map(([NOMETAB, [DESCRTAB]]) => ({ NOMETAB, DESCRTAB, TIPONUMERACAO: "M" }));
  rows.TDDCAM = Object.entries(dictionary).flatMap(([NOMETAB, [, columns]]) =>
    Object.entries(columns).map(([NOMECAMPO, DESCRCAMPO]) => ({ NOMETAB, NOMECAMPO, DESCRCAMPO, TIPCAMPO: "S" })),
  );
  for (const [name, [, columns]] of Object.entries(dictionary)) {
    const names = Object.keys(columns);
    db.exec(`CREATE TABLE ${name} (${names.join(", ")})`);
    const insert = db.prepare(`INSERT INTO ${name} VALUES (${names.map(() => "?").join(", ")})`);
    for (const row of rows[name] ?? []) insert.run(...names.map((c) => row[c] ?? null));
  }
  db.exec("PRAGMA query_only = ON");
  return db;
}

// Traduz o que o app e o assistente costumam usar de Oracle para SQLite. Não é um tradutor completo: o que sobrar
// vira erro de sintaxe na execução.
export function toSqlite(sql) {
  let s = sql.trim().replace(/;+\s*$/, "");
  s = s.replace(/\bFROM\s+DUAL\b/gi, "");
  s = s.replace(/\bSYSDATE\b/gi, "date('now')");
  s = s.replace(/\bNVL\s*\(/gi, "IFNULL(");
  s = s.replace(/\bTRUNC\s*\(\s*([^(),]+?)\s*\)/gi, "date($1)");
  s = s.replace(/\bTO_DATE\s*\(\s*'(\d{2})\/(\d{2})\/(\d{4})'\s*,\s*'DD\/MM\/YYYY'\s*\)/gi, "'$3-$2-$1'");
  s = s.replace(/\bTO_DATE\s*\(\s*'(\d{4})-(\d{2})-(\d{2})'\s*,\s*'YYYY-MM-DD'\s*\)/gi, "'$1-$2-$3'");
  s = s.replace(/\bTO_NUMBER\s*\(/gi, "CAST(1*(").replace(/CAST\(1\*\(([^()]*)\)/g, "CAST($1 AS REAL)");
  s = s.replace(/\bOFFSET\s+(\d+)\s+ROWS?\b/gi, "OFFSET $1");
  const limit = /\bFETCH\s+(?:FIRST|NEXT)\s+(\d+)\s+ROWS?\s+ONLY\b/i;
  const fetch = limit.exec(s);
  if (fetch) {
    s = s.replace(limit, "");
    // SQLite quer LIMIT antes de OFFSET.
    const offset = /\bOFFSET\s+\d+/i.exec(s);
    s = offset ? s.replace(offset[0], `LIMIT ${fetch[1]} ${offset[0]}`) : `${s} LIMIT ${fetch[1]}`;
  }
  // WHERE ROWNUM <= n (ou AND ROWNUM <= n) no nível da consulta vira LIMIT n.
  const rownum = /\s+(WHERE|AND)\s+ROWNUM\s*(<=|<)\s*(\d+)/i.exec(s);
  if (rownum) {
    const max = Number(rownum[3]) - (rownum[2] === "<" ? 1 : 0);
    s = s.replace(rownum[0], rownum[1].toUpperCase() === "AND" ? "" : " WHERE 1 = 1");
    s = `${s} LIMIT ${Math.max(max, 0)}`;
  }
  return s;
}

export const MAX_ROWS = 5000;

// Executa a consulta (já validada) e devolve { fields, rows } no formato do Sankhya (linhas posicionais).
export function runQuery(db, sql) {
  const stmt = db.prepare(toSqlite(sql));
  stmt.setReturnArrays(true);
  const fields = stmt.columns().map((c) => c.name.toUpperCase());
  const rows = stmt.all().slice(0, MAX_ROWS);
  return { fields, rows: rows.map((r) => r.map((v) => (typeof v === "bigint" ? Number(v) : v))) };
}
