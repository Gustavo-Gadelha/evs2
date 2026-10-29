# SPEC — snk-assistant

## Objetivo

Ferramenta pessoal para montar e rodar consultas SQL Oracle no banco do Sankhya via `DbExplorerSP.executeQuery`: um builder visual gera o SQL, o editor permite ajustá-lo à mão, e o resultado aparece em tabela. Um único usuário (o desenvolvedor), rodando só na própria máquina. Nunca terá deploy.

## Escopo

- **Somente leitura**: uma instrução `SELECT`/`WITH` por execução (ver "Trava de leitura").
- **Um único endpoint do Sankhya**: `DbExplorerSP.executeQuery`. Nenhum outro serviço do gateway é chamado, exceto login/logout.
- **Sem esquema**: tabelas, aliases e expressões são digitados à mão; não há navegação no dicionário nem autocomplete.
- **Sem IA** e sem dependências além de next, react, tailwind, zod, `@tanstack/react-table` (v9) e `@tanstack/react-virtual`.

## Integração com o Sankhya

Port de `isis-orbita/backend/apps/integrations/sankhya` (`auth.py`, `clients.py`, `exceptions.py`, `parsers.py`), em `lib/sankhya/`.

- **Login**: `POST {BASE_URL}/login` com os headers `appkey`, `token`, `username`, `password`; timeout 10s. Erro de auth quando: status não 2xx, corpo não JSON, `error` não nulo, ou `bearerToken` ausente/vazio.
- **Sessão**: `Authorization: Bearer <token>` em toda requisição. Login sob demanda na primeira requisição; token em cache no `globalThis` (sobrevive ao HMR).
- **Logout**: `POST {BASE_URL}/gateway/v1/mge/service.sbr?serviceName=MobileLoginSP.logout` com os 4 headers + bearer; timeout 10s. Sem token, é no-op.
- **Consulta**: `POST gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json` com `{ serviceName, requestBody: { sql } }`; timeout 30s. 401 → limpa o token, refaz o login e tenta **uma** vez de novo.
- **Erros**: `SankhyaAuthError` (502), `SankhyaTimeoutError` (504), `SankhyaClientError` (502). O gateway responde 200 mesmo quando a consulta falha: `status !== "1"` no corpo é erro de consulta, com a mensagem do Oracle em `statusMessage`.

## Rotas

| Rota                       | Faz                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST /api/sankhya/query`  | `{ sql }` (zod: não vazio, ≤ 100 KB) → `{ columns, rows, durationMs, raw }`; 400 `ReadOnlyViolation` se a trava recusar; 422 `SankhyaQueryError` com o `statusMessage` do Oracle (gateway com `status !== "1"` ou não 2xx com mensagem) |
| `POST /api/sankhya/login`  | Força novo login; devolve só `{ ok, authenticatedAt }`                                                                |
| `POST /api/sankhya/logout` | Logout no Sankhya                                                                                                     |
| `GET /api/sankhya/status`  | `{ authenticated, authenticatedAt, baseUrl }`                                                                         |

`columns` segue `fieldsMetadata` ordenado por `order`; `rows` vem como o Sankhya devolve (mesma regra do `parse_query_result`).

## Proteções

1. Credenciais só em `.env.local` (`SANKHYA_BASE_URL`, `SANKHYA_APPKEY`, `SANKHYA_TOKEN`, `SANKHYA_USERNAME`, `SANKHYA_PASSWORD`), sem `NEXT_PUBLIC_`, validadas com zod na subida (`instrumentation.ts`).
2. Rotas da API respondem 404 fora de `NODE_ENV=development`.
3. Rotas recusam `Host` que não seja `localhost`/`127.0.0.1` e `Origin` presente e não local (DNS rebinding e cross-site).
4. Só Docker Compose: `next dev` em `0.0.0.0:3100` dentro do container, publicado apenas em `127.0.0.1:3100`. `dev`/`build`/`start` do `package.json` saem com erro.
5. Senha, token, appkey e bearer token nunca aparecem em logs nem em respostas (headers e corpos passam por redação).
6. O navegador não escolhe path, método nem headers: a única chamada ao gateway é a de `executeQuery`, montada no servidor.

## Trava de leitura

`lib/sql/read-only.ts`, a mesma função no cliente (aviso antes de enviar) e no servidor (recusa com 400 e o motivo). Checagem léxica, sem parser:

1. Remove comentários (`--`, `/* */`) e literais (`'...'`, `q'[...]'` e demais delimitadores de `q'`, `"IDENT"`).
2. No que sobra, exige:
   - começar com `SELECT` ou `WITH`;
   - nenhum `;` (uma instrução só);
   - nenhuma destas palavras soltas: `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `GRANT`, `REVOKE`, `EXECUTE`, `BEGIN`, `DECLARE`, `CALL`, `LOCK`, nem a sequência `FOR UPDATE`.

Limitações aceitas: pode recusar um SELECT legítimo que use uma dessas palavras como identificador sem aspas (contorno: aspas duplas); não impede funções PL/SQL que escrevam chamadas dentro de um SELECT. A garantia completa só viria de um usuário de banco sem permissão de escrita, fora do alcance pela API.

## Modelo do builder

`lib/sql/query-state.ts`. Serializável; é o que vai para histórico, consultas salvas e `presets.ts`.

```ts
type QueryState = {
  from: { table: string; alias: string };
  joins: { type: "INNER" | "LEFT" | "RIGHT" | "FULL"; table: string; alias: string; on: CondGroup }[];
  distinct: boolean;
  select: { expr: Expr; alias?: string }[]; // vazio → SELECT *
  where: CondGroup;
  groupBy: { mode: "auto" | "manual"; exprs: string[] };
  having: CondGroup;
  orderBy: { expr: string; dir: "ASC" | "DESC"; nulls?: "FIRST" | "LAST" }[];
  limit: { rows: number; offset: number; style: "fetch" | "rownum" } | null;
};
type Expr =
  | { kind: "raw"; sql: string }
  | { kind: "agg"; fn: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX" | "LISTAGG"; arg: string; distinct: boolean };
type CondGroup = { op: "AND" | "OR"; items: (Cond | CondGroup)[] };
type Cond = {
  left: string;
  op: "=" | "<>" | "<" | "<=" | ">" | ">=" | "LIKE" | "NOT LIKE" | "IN" | "NOT IN" | "BETWEEN" | "IS NULL" | "IS NOT NULL";
  right: { kind: "text" | "number" | "date" | "expr"; value: string; value2?: string };
};
```

- Tabela e alias: identificador Oracle `[A-Z_][A-Z0-9_$#]*`, convertidos para maiúsculas. Expressões: texto livre.
- Menu ƒ (`lib/sql/functions.ts`) insere modelos no cursor: `NVL`, `COALESCE`, `DECODE`, `CASE WHEN`, `TRUNC`, `TO_CHAR(x,'DD/MM/YYYY')`, `TO_DATE`, `EXTRACT`, `SUBSTR`, `UPPER`, `SYSDATE`, `ADD_MONTHS`.

## Gerador Oracle

`toOracleSql(state): { sql: string; problems: Problem[] }` em `lib/sql/to-oracle.ts`, função pura. `Problem = { section: "from" | "joins" | "select" | "where" | "groupBy" | "having" | "orderBy" | "limit"; message: string }`.

- Uma cláusula por linha, com indentação; `CondGroup` aninhado vira parênteses.
- Linhas em branco do builder (condição sem lado esquerdo, coluna vazia, join sem tabela) são ignoradas, sem gerar problema.
- Valores:
  - `text`: entre aspas simples, com `'` interno duplicado;
  - `number`: validado;
  - `date`: `TO_DATE('YYYY-MM-DD','YYYY-MM-DD')`;
  - `IN`/`NOT IN`: valores separados por vírgula, cada um formatado conforme `kind`;
  - `BETWEEN`: usa `value` e `value2`;
  - `expr`: entra como está;
  - `IS NULL`/`IS NOT NULL`: ignoram `right`.
- `LISTAGG(arg, ', ') WITHIN GROUP (ORDER BY arg)`; `COUNT` com `arg` vazio vira `COUNT(*)`.
- GROUP BY `auto`: se houver agregação no SELECT, agrupa por todas as expressões `raw` do SELECT; sem agregação, não há GROUP BY. `manual` usa `exprs`.
- Limite:
  - `fetch` (padrão, Oracle 12c+): `OFFSET n ROWS FETCH NEXT n ROWS ONLY`, omitindo `OFFSET` quando for 0;
  - `rownum` (11g): `SELECT * FROM (<consulta>) WHERE ROWNUM <= n`; com offset, usa a forma aninhada com `RNUM`.
- Problemas (sem gerar SQL quebrado):
  - FROM sem tabela;
  - identificador inválido;
  - join sem condição `ON`;
  - HAVING sem GROUP BY (nem agregação no SELECT, nem GROUP BY manual);
  - `number` inválido;
  - `BETWEEN` sem `value2`;
  - `IN` vazio;
  - limite ≤ 0.

  Havendo problemas, o SQL não é atualizado no editor e cada problema aparece na seção correspondente.

## UI (`/`)

Três colunas em telas largas; empilhadas em telas estreitas.

- **Header**: base URL, status da sessão, Login/Logout.
- **Builder**: seções recolhíveis FROM · JOINS · SELECT (+ DISTINCT) · WHERE (grupos AND/OR aninháveis) · GROUP BY (auto/manual) · HAVING · ORDER BY · LIMITE. Linhas com adicionar, remover e ↑↓. Problemas do gerador sob a seção de origem.
- **Editor SQL**: textarea monoespaçada.
  - Selo "gerado pelo builder": o editor acompanha o builder em tempo real.
  - Selo "editado à mão": a primeira edição manual congela o texto. "↺ regenerar" pede confirmação inline antes de descartar a edição.
  - Ações:
    - Rodar (Ctrl/Cmd+Enter): sempre executa o texto do editor, passando pela trava antes;
    - Copiar;
    - Salvar consulta (nome inline).
- **Resultado**: tabela (padrão) ou JSON bruto; número de linhas e duração; "Copiar CSV" com todas as linhas e colunas do resultado, sem aplicar filtros; erro de consulta (`statusMessage`) em destaque.
  - Tabela com TanStack Table (`app/_components/result-table.tsx`) e linhas virtualizadas com TanStack Virtual (altura fixa de 28px), sem limite de linhas na tela.
  - Ordenação por clique no cabeçalho (ASC → DESC → nenhuma): número como número, texto em ordem natural pt-BR, nulos por último no ASC.
  - Busca global e filtro por coluna: "contém", sem diferenciar maiúsculas nem acentos.
  - Menu "Colunas" para mostrar/ocultar; coluna `#` com a posição da linha na ordem exibida.
  - Colunas identificadas pelo índice (nomes podem repetir); largura calculada pelo conteúdo (72–420px).
  - Cada resultado novo começa sem filtros, ordenação ou colunas ocultas.
- **Sidebar**:
  - Consultas salvas: nome + `QueryState` + SQL + se foi editado à mão;
  - Modelos: `presets.ts`, consultas de exemplo em `QueryState`, editáveis;
  - Histórico: as últimas 50 execuções no `localStorage`, com SQL, estado, linhas, status e horário; o resultado só é guardado quando tem até ~200 KB, e só a entrada mais recente o mantém se a cota estourar; há botão de limpar.
  - Clicar em um item restaura builder e editor.

## Estrutura

```
lib/sql/query-state.ts      tipos + estado vazio
lib/sql/to-oracle.ts        gerador
lib/sql/read-only.ts        trava de leitura
lib/sql/functions.ts        modelos do menu ƒ
lib/sankhya/                auth, client, errors, redact, state, route (existentes)
app/api/sankhya/query/      rota de consulta
app/_components/builder/    from-joins, select-list, cond-group, group-having, order-limit
app/_components/            explorer, auth-header, sql-editor, result-view, sidebar, save-form
presets.ts                  modelos em QueryState
```

## Verificação

Sem testes automatizados. `pnpm typecheck`; no container, contra um Sankhya falso: SQL gerado para join + agregação + HAVING, WHERE aninhado, os dois estilos de limite e escape de aspas; casos da trava de leitura que devem passar e ser recusados; no navegador, o fluxo montar → editar à mão → regenerar → rodar → salvar → recarregar do histórico.

## Fora do escopo

- Deploy, build de produção, multiusuário.
- Outros serviços do gateway; escrita no ERP.
- Navegação no esquema, autocomplete, parser de SQL (edição manual não volta para o builder).
- IA.
