# SPEC — snk-assistant

## Objetivo

Ferramenta pessoal para montar e rodar consultas SQL Oracle no banco do Sankhya via `DbExplorerSP.executeQuery`: um builder visual gera o SQL, o editor permite ajustá-lo à mão, e o resultado aparece em tabela. Um único usuário (o desenvolvedor), rodando só na própria máquina. Roda como build de produção (standalone) dentro do Docker Compose ou, para desenvolver, com `pnpm dev` em loopback; nunca com deploy fora da máquina.

## Escopo

- **Somente leitura**: uma instrução `SELECT`/`WITH` por execução (ver "Trava de leitura").
- **Um único endpoint do Sankhya**: `DbExplorerSP.executeQuery`. Nenhum outro serviço do gateway é chamado, exceto login/logout.
- **Dicionário somente leitura**: tabelas e colunas sugeridas vêm de `TDDTAB`/`TDDCAM`, lidas pelo mesmo `executeQuery` (SQL montado no servidor, nome da tabela validado). Tabelas, aliases e expressões continuam digitados à mão; sem navegação em árvore nem parser.
- **Sem IA** e sem dependências além de next, react, tailwind, zod, `@tanstack/react-table` (v9), `@tanstack/react-virtual`, `@dnd-kit/react` (arrastar para reordenar), `downshift` (combobox do autocomplete do dicionário), `lucide-react` (ícones), shadcn/ui (componentes em `src/components/ui/`, com `@base-ui/react`, `class-variance-authority`, `cn`, `tw-animate-css` e `shadcn`), `sonner` (toasts), `@uiw/react-codemirror` e `@codemirror/lang-sql` (editor SQL), `sql-formatter` (formatação) e, para o histórico e as consultas salvas, Prisma 7 com PostgreSQL (`@prisma/client`, `@prisma/adapter-pg`, `pg`; `prisma` no dev).

## Integração com o Sankhya

Port de `isis-orbita/backend/apps/integrations/sankhya` (`auth.py`, `clients.py`, `exceptions.py`, `parsers.py`), em `src/features/sankhya/server/`.

- **Login**: `POST {BASE_URL}/login` com os headers `appkey`, `token`, `username`, `password`; timeout 10s. Erro de auth quando: status não 2xx, corpo não JSON, `error` não nulo, ou `bearerToken` ausente/vazio.
- **Sessão**: `Authorization: Bearer <token>` em toda requisição. Login sob demanda na primeira requisição; token em cache no `globalThis` (sobrevive ao HMR).
- **Logout**: `POST {BASE_URL}/gateway/v1/mge/service.sbr?serviceName=MobileLoginSP.logout` com os 4 headers + bearer; timeout 10s. Sem token, é no-op.
- **Consulta**: `POST gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json` com `{ serviceName, requestBody: { sql } }`; timeout 30s. 401 → limpa o token, refaz o login e tenta **uma** vez de novo.
- **Perfil ativo**: base URL e credenciais vêm do perfil ativo (Postgres); sem perfil, as rotas do Sankhya respondem 409 `NoActiveProfileError`. O token em cache guarda o `profileId` e só vale para ele; trocar, editar ou excluir o perfil faz logout (melhor esforço) e descarta o token. O cache do dicionário é por perfil.
- **Erros**: `SankhyaAuthError` (502), `SankhyaTimeoutError` (504), `SankhyaClientError` (502), `NoActiveProfileError` (409). O gateway responde 200 mesmo quando a consulta falha: `status !== "1"` no corpo é erro de consulta, com a mensagem do Oracle em `statusMessage`.

## Perfil padrão (opcional)

`pnpm seed` (`scripts/seed-profile.mjs`) cria no Postgres o perfil descrito por `SANKHYA_PROFILE_NAME`, `_BASE_URL`, `_APPKEY`, `_TOKEN`, `_USERNAME` e `_PASSWORD` do `.env`, para quem não quer cadastrá-lo pela tela.

- **Só se definido**: variável vazia conta como ausente. Nenhuma definida: não faz nada (exit 0). Só algumas: erro listando as que faltam (exit 1).
- **Validação** igual à das rotas de perfil (textos aparados, até 500 caracteres, nome até 100, URL `http(s)`).
- **Cria ou atualiza** pelo nome (único): se já existe, troca base URL e segredos pelos do `.env`. O perfil vira o ativo só se não houver um ativo válido, como no cadastro pela tela.
- **Segredos** cifrados com `ENCRYPTION_KEY` no mesmo formato de `src/lib/db/crypto.ts` (o script o reimplementa, pois roda no Node puro, sem `@/` nem `server-only`) e nunca aparecem na saída.
- **Roda no host**, contra o Postgres do compose (`DATABASE_URL`), depois de o app ter aplicado as migrations. As variáveis `SANKHYA_PROFILE_*` não vão ao container (o `compose.yaml` não as repassa e o `.dockerignore` exclui o `.env`). Um app já em execução precisa ser reiniciado, pois guarda os perfis em memória.

## Rotas

| Rota                       | Faz                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `POST /api/sankhya/query`  | `{ sql }` (zod: não vazio, ≤ 100 KB) → `{ columns, rows, durationMs, raw }`; 400 `ReadOnlyViolation` se a trava recusar; 422 `SankhyaQueryError` com o `statusMessage` do Oracle (gateway com `status !== "1"` ou não 2xx com mensagem) |
| `POST /api/sankhya/login`  | Faz logout da sessão existente (best-effort, mesmo inválida) e força novo login; devolve só `{ ok, authenticatedAt }` |
| `POST /api/sankhya/logout` | Logout no Sankhya                                                                                                     |
| `GET /api/sankhya/status`  | `{ authenticated, authenticatedAt, baseUrl, profile }` (`baseUrl`/`profile` nulos sem perfil ativo)                  |
| `GET/POST /api/profiles`, `PATCH/DELETE /api/profiles/[id]`, `POST /api/profiles/active` | Perfis de acesso: lista `{ profiles: [{ id, name, baseUrl, username }], activeId }` (nunca appkey, token nem senha), cria, edita (segredo em branco mantém), exclui e troca o perfil ativo; cada uma devolve a lista atualizada |
| `GET /api/sankhya/dictionary/tables` | `[{ name, description }]` de `TDDTAB`, em cache no servidor                                                  |
| `GET /api/sankhya/dictionary/columns?table=` | `[{ name, description }]` de `TDDCAM` para a tabela (400 `InvalidTable` se o nome não for um identificador Oracle) |
| `GET /api/sankhya/dictionary/table?table=` | `{ columns, relations }` da tabela, em cache por perfil: colunas de `TDDCAM` (nome, descrição, `TIPCAMPO`, `TAMANHO`) com os valores de domínio de `TDDOPC`, e as ligações liberadas de `TDDLIG` (instâncias de `TDDINS`) com os pares de colunas de `TDDLGC`, vistas dos dois lados; só `SELECT`, 400 `InvalidTable` como em `columns` |
| `POST /api/sankhya/dictionary/refresh` | Descarta o cache do dicionário do perfil ativo e lê `TDDTAB` de novo no ERP (só `SELECT`); devolve `[{ name, description }]`; as colunas voltam a ser lidas sob demanda |
| `GET/POST/DELETE /api/history` | Lista (sem o resultado, com `hasResult`), grava (e poda além de 200) e limpa o histórico no Postgres                |
| `GET /api/history/[id]`    | Entrada completa, com o resultado quando guardado                                                                     |
| `GET/POST /api/saved`, `DELETE /api/saved/[id]` | Consultas salvas no Postgres; cada uma devolve a lista atualizada                                  |

`columns` segue `fieldsMetadata` ordenado por `order`; `rows` vem como o Sankhya devolve (mesma regra do `parse_query_result`).

## Proteções

1. Credenciais só nos perfis do Postgres (`Profile.secret`: appkey, token, usuário e senha em JSON cifrado com AES-256-GCM, `src/lib/db/crypto.ts`). A chave (32 bytes em base64) vem de `ENCRYPTION_KEY` no `.env`, fora do banco e do repositório: protege um dump do Postgres copiado sozinho, não quem lê o `.env`; trocá-la invalida os perfis salvos. Appkey, token e senha nunca saem do servidor (as rotas de perfil só devolvem nome, base URL e usuário), sem `NEXT_PUBLIC_`; a redação de logs cobre os segredos de todos os perfis. As únicas credenciais em `.env` são as do próprio Postgres (`POSTGRES_*`, `DATABASE_URL`) e a chave de cifra (`ENCRYPTION_KEY`); o `.env` é ignorado pelo git e pelo Docker, e o `.env.example` traz só placeholders; as credenciais do Sankhya só entram no `.env` se você optar pelo perfil padrão (ver "Perfil padrão"), e nunca no `compose.yaml` nem na imagem.
2. (Removida.) As rotas não checam `NODE_ENV`; a proteção depende das proteções 3 e 4.
3. Rotas recusam `Host` que não seja `localhost`/`127.0.0.1` e `Origin` presente e não local (DNS rebinding e cross-site).
4. Só na máquina local: Docker Compose ou `pnpm dev`. `pnpm dev` roda `prisma generate`, `prisma migrate deploy` e `next dev --hostname 127.0.0.1 --port 3100` (loopback, nunca `0.0.0.0`), com o Postgres do compose (`docker compose up -d postgres`; `DATABASE_URL` do `.env`). No Docker: build standalone (`node server.js`) em `0.0.0.0:3100` dentro do container, publicado apenas em `127.0.0.1:3100`; o Postgres (imagem `postgres:18-alpine`, serviço `postgres`) só é publicado em `127.0.0.1:${POSTGRES_PORT}` e o app só sobe depois do healthcheck dele; o `entrypoint.sh` aplica as migrations (CLI do Prisma isolado em `/opt/prisma`) antes de iniciar o app. O `package.json` não tem script `start` (o `seed` é o único comando auxiliar, ver "Perfil padrão"); `build` roda `prisma generate && next build` e só serve ao Dockerfile.
5. Senha, token, appkey e bearer token nunca aparecem em logs nem em respostas (headers e corpos passam por redação).
6. O navegador não escolhe path, método nem headers: a única chamada ao gateway é a de `executeQuery`, montada no servidor.
7. O banco Postgres guarda dados reais do ERP: fica no volume Docker nomeado `pgdata` (o mesmo banco serve o Docker e o `pnpm dev`), fora do bind mount, com senha vinda do `.env` e porta só em loopback; `src/lib/db/` e os `server/` das features começam com `import "server-only"` e as rotas `/api/history` e `/api/saved` passam pelas mesmas proteções 2 e 3 (`localOnly`).

## Trava de leitura

`src/lib/sql/read-only.ts`, a mesma função no cliente (aviso antes de enviar) e no servidor (recusa com 400 e o motivo). Checagem léxica, sem parser:

1. Remove comentários (`--`, `/* */`) e literais (`'...'`, `q'[...]'` e demais delimitadores de `q'`, `"IDENT"`).
2. No que sobra, exige:
   - começar com `SELECT` ou `WITH`;
   - nenhum `;` (uma instrução só);
   - nenhuma destas palavras soltas: `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `DROP`, `ALTER`, `CREATE`, `TRUNCATE`, `GRANT`, `REVOKE`, `EXECUTE`, `BEGIN`, `DECLARE`, `CALL`, `LOCK`, nem a sequência `FOR UPDATE`.

Limitações aceitas: pode recusar um SELECT legítimo que use uma dessas palavras como identificador sem aspas (contorno: aspas duplas); não impede funções PL/SQL que escrevam chamadas dentro de um SELECT. A garantia completa só viria de um usuário de banco sem permissão de escrita, fora do alcance pela API.

## Modelo do builder

`src/lib/sql/query-state.ts`. Serializável; é o que vai para histórico e consultas salvas.

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
  omit?: Exclude<Section, "from">[]; // seções ignoradas na geração do SQL, mantidas no estado
};
// `off?: boolean` em colunas, joins, condições, grupos e ordenações: o item é ignorado no SQL, mas fica no builder.
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
- Menu ƒ (`src/lib/sql/functions.ts`) insere modelos no cursor: `NVL`, `COALESCE`, `DECODE`, `CASE WHEN`, `TRUNC`, `TO_CHAR(x,'DD/MM/YYYY')`, `TO_DATE`, `EXTRACT`, `SUBSTR`, `UPPER`, `SYSDATE`, `ADD_MONTHS`.

## Gerador Oracle

`toOracleSql(state): { sql: string; problems: Problem[] }` em `src/lib/sql/to-oracle.ts`, função pura. `Problem = { section: "from" | "joins" | "select" | "where" | "groupBy" | "having" | "orderBy" | "limit"; message: string }`.

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

- **Header**: título, selo "development" e base URL do perfil ativo à esquerda; à direita, seletor de perfil, botão Perfis (diálogo de cadastro), status da sessão e Login/Logout, com o mesmo estilo (`outline`, tamanho `sm`).
- **Builder**: seções recolhíveis FROM · JOINS · SELECT (+ DISTINCT) · WHERE (grupos AND/OR aninháveis) · GROUP BY (auto/manual) · HAVING · ORDER BY · LIMITE. Cada bloco, exceto FROM, tem no cabeçalho um checkbox "omitir" que tira a seção inteira do SQL sem apagá-la (SELECT omitido vira `SELECT *`). Linhas com adicionar, remover, ↑↓, arrastar pelo ícone de grip à esquerda (colunas, joins, condições, grupos e ordenações; também pelo teclado) e ◉/⊘ para omitir só aquele item do SQL (a seção mostra quantos estão omitidos). Campos de tabela e de expressão sugerem tabelas e `ALIAS.COLUNA` do dicionário (`<datalist>` nativo; falha do dicionário só tira as sugestões). Problemas do gerador sob a seção de origem.
- **Editor SQL**: CodeMirror 6 (`src/features/query/components/sql-code-editor.tsx`) com destaque Oracle (PL/SQL).
  - Autocomplete do dicionário (`use-sql-schema`): tabelas do `TDDTAB` e, para as que o SQL cita, as colunas do `TDDCAM`; os aliases do FROM/JOIN são resolvidos pelo editor, e as palavras-chave e funções vêm do dialeto.
  - Formatação só pelo botão "Formatar" (`src/lib/sql/format.ts`, sql-formatter em PL/SQL, palavras-chave em maiúsculas, recuo de 2); o editor nunca reformata sozinho, porque atrapalhava a digitação. Formatar conta como edição à mão. SQL que o formatador não entende (aspas sem fechar) fica como está, com um aviso.
  - Ctrl/Cmd+Enter roda a consulta (não insere linha).
  - Selo "gerado pelo builder": o editor acompanha o builder em tempo real.
  - Selo "editado à mão": a primeira edição manual congela o texto. "↺ regenerar" pede confirmação inline antes de descartar a edição.
  - Ações:
    - Rodar (Ctrl/Cmd+Enter): sempre executa o texto do editor, passando pela trava antes;
    - Formatar;
    - Copiar;
    - Salvar consulta (nome inline).
- **Resultado**: tabela (padrão) ou JSON bruto; número de linhas e duração; "Copiar CSV" com todas as linhas e colunas do resultado, sem aplicar filtros; erro de consulta (`statusMessage`) em destaque no painel.
- **Avisos**: toasts do Sonner no canto inferior direito, com ícone por tipo (erro em vermelho): falhas de login, de perfis, do dicionário e do banco, "nenhum perfil ativo" (fixo, com ação para abrir Perfis), confirmações de perfil salvo/excluído/trocado e "SQL/CSV copiado". O erro de consulta fica só no painel de resultado; a trava de leitura e os problemas do gerador continuam inline.
  - Tabela com TanStack Table (`src/features/results/result-table.tsx`) e linhas virtualizadas com TanStack Virtual (altura fixa de 28px), sem limite de linhas na tela.
  - Ordenação por clique no cabeçalho (ASC → DESC → nenhuma): número como número, texto em ordem natural pt-BR, nulos por último no ASC.
  - Busca global e filtro por coluna: "contém", sem diferenciar maiúsculas nem acentos.
  - Menu "Colunas" para mostrar/ocultar; coluna `#` com a posição da linha na ordem exibida.
  - Colunas identificadas pelo índice (nomes podem repetir); largura calculada pelo conteúdo (72–420px).
  - Cada resultado novo começa sem filtros, ordenação ou colunas ocultas.
- **Sidebar**:
  - Nova consulta: botão no topo, acima das consultas salvas, que limpa builder, editor e resultado;
  - Dicionário: botão logo abaixo de Nova consulta, abre o diálogo com busca de tabelas por nome/descrição; a tabela escolhida mostra as colunas (tipo, tamanho, valores de domínio, com filtro) e os relacionamentos, com os botões "Ver 20 linhas" (substitui a consulta por um `SELECT` de 20 linhas da tabela) e "JOIN" em cada relacionamento (acrescenta o JOIN ao builder; exige a tabela no FROM ou num JOIN, via `src/lib/sql/add-join.ts`), com o botão "Atualizar do ERP", que invalida o cache (servidor e navegador) e consulta o dicionário de novo, recarregando também o autocomplete;
  - Consultas salvas: nome + `QueryState` + SQL + se foi editado à mão; no Postgres (as do antigo `localStorage` são importadas uma vez e removidas de lá);
  - Histórico: as últimas 200 execuções no Postgres, com SQL, estado, linhas, status e horário; `state` e `result` são `jsonb` (a ordem das chaves dos objetos não é preservada); o resultado só é guardado quando tem até 5 MB e sem caractere NUL, que o jsonb não aceita (a listagem não o traz; clicar na entrada o busca); há botão de limpar.
  - Clicar em um item restaura builder e editor.

## Estrutura

```
src/app/                    só roteamento: layout, page, globals.css e api/**/route.ts (cada um só reexporta o handler da feature)
src/lib/sql/                query-state (tipos + estado vazio), to-oracle (gerador), add-join (JOIN a partir de uma ligação do dicionário), read-only (trava de leitura), format (formatador), functions (menu ƒ)
src/lib/                    api (cliente HTTP), types; db/ = client Prisma, crypto (AES-256-GCM dos segredos dos perfis), `generated/` gerado e ignorado pelo git
src/components/             combobox (Downshift); ui/ = componentes shadcn (button, input, textarea, native-select, checkbox, label, field, badge, alert, card, dialog, dropdown-menu, tabs, separator, sonner)
src/features/sankhya/       components/auth-header; server/: auth, client, errors, redact, state, local-only e handlers login/logout/status
src/features/query/         components/sql-editor e sql-code-editor; server/: execute (executeQuery) e handler query
src/features/dictionary/    components/dictionary-browser, table-detail e dictionary-provider (autocomplete); use-sql-schema (esquema do editor), client (cache de promessas), search (índice, até 50); server/: dictionary (TDDTAB/TDDCAM), detail (TDDCAM/TDDOPC/TDDLIG/TDDINS/TDDLGC) e handlers tables/columns/table/refresh
src/features/history/       components/sidebar e save-form; history (tipos, limites, cliente HTTP); server/: store (Prisma) e handlers history/saved
src/features/builder/       builder, from-joins, select-list, cond-group, group-having, order-limit, expr-input, editable-list, sortable-list, list, row-actions, section
src/features/results/       result-table, result-view
src/features/explorer/      explorer (orquestra a tela; page.tsx importa daqui)
src/features/profiles/      profiles (tipos e cliente HTTP); components/profiles-dialog; server/: store (Prisma + cache decifrado em memória) e handlers profiles, profile-by-id, active
prisma/                     `schema.prisma` (PostgreSQL; `state` e `result` em jsonb) e migrações (aplicadas por `prisma migrate deploy` no `pnpm dev` e pelo `entrypoint.sh` na subida do container)
compose.yaml                serviços `postgres` (postgres:18-alpine, volume `pgdata`, healthcheck) e `snk-assistant`; lê o `.env`
scripts/seed-profile.mjs    `pnpm seed`: cria ou atualiza o perfil padrão a partir das `SANKHYA_PROFILE_*` do `.env` (ver "Perfil padrão")
entrypoint.sh               valida `DATABASE_URL` e `ENCRYPTION_KEY`, aplica as migrations e executa o servidor (`exec`)
.env.example                modelo do `.env` (Postgres, `DATABASE_URL`, `ENCRYPTION_KEY`); o `.env` é ignorado pelo git e pelo Docker
```

## Verificação

Só há testes automatizados do SQL (`pnpm test:sql`, `node --test` sobre `src/lib/sql/`: gerador, trava de leitura, JOIN do dicionário e formatador; sem testes da aplicação nem CI). `pnpm typecheck`; no container, contra um Sankhya falso: SQL gerado para join + agregação + HAVING, WHERE aninhado, os dois estilos de limite e escape de aspas; casos da trava de leitura que devem passar e ser recusados; no banco, subir o compose do zero (migrations aplicadas, colunas `jsonb`), reiniciar o app sem perder perfis, histórico nem consultas salvas, e gravar um resultado com NUL (entra sem o resultado); no navegador, o fluxo montar → editar à mão → regenerar → rodar → salvar → recarregar do histórico.

## Fora do escopo

- Deploy fora da máquina local, multiusuário.
- Outros serviços do gateway; escrita no ERP.
- Navegação em árvore do esquema e parser de SQL (edição manual não volta para o builder).
- IA.
