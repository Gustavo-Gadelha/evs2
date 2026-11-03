# Tarefa: agente de IA local (Ollama) no snk-assistant

Leia `AGENTS.md` e `SPEC.md` antes de começar. Este documento **autoriza explicitamente** uma mudança de escopo: o SPEC hoje diz "Sem IA" e lista IA em "Fora do escopo". As demais regras do AGENTS.md continuam valendo, em especial a de **local-only** e a de **somente leitura**. Trabalhe por fases e **pare ao fim de cada uma** para eu revisar; não faça commit sem eu pedir.

## 1. Objetivo

Adicionar um agente que transforma uma pergunta em português em uma consulta SQL Oracle para o Sankhya. Exemplo: "valor total das notas de venda por vendedor no mês passado". O agente usa o dicionário `TDDTAB`/`TDDCAM` como base de conhecimento (RAG) e valida o que gera antes de entregar ao usuário. **Quem executa a consulta continua sendo o usuário**, pelo botão Rodar, como hoje.

Isto faz parte de um projeto acadêmico. Cada técnica precisa ter função real e justificável na solução:

- **LLM:** interpreta a pergunta e gera o SQL.
- **Agente com ferramentas:** decide quais tabelas buscar, lê as colunas, valida e corrige.
- **RAG + embeddings:** recupera só as tabelas e colunas relevantes, porque o dicionário inteiro não cabe no contexto de um modelo local.
- **Validação do resultado da IA:** trava de leitura, checagem sintática no Oracle e autocorreção a partir do `statusMessage`.

## 2. Restrição central: duas máquinas

O mesmo código precisa rodar bem em duas máquinas muito diferentes:

| | Desktop (desenvolvimento) | Notebook (apresentação) |
|---|---|---|
| Hardware | i5-12400F, RTX 3060 Ti (8 GB VRAM), 16 GB RAM | i7-10510U (4c/8t, baixo consumo), vídeo integrado, 16 GB RAM |
| Inferência | GPU | Só CPU, com Docker Desktop/WSL2 no Windows |
| Gargalo | — | Leitura do prompt (prefill) e número de voltas do agente |

Tudo que muda entre elas fica em **configuração**, nunca em código. Use um preset `AI_PRESET=gpu|cpu`, que define padrões sobrescrevíveis por variáveis individuais:

| Variável | `gpu` | `cpu` | Observação |
|---|---|---|---|
| `AI_CHAT_MODEL` | `qwen3:8b` | `qwen3:4b` | Alternativas: `qwen2.5-coder:7b` / `:3b`. Confirme com `ollama show` que o modelo tem a capacidade `tools`. |
| `AI_THINK` | `false` | `false` | O modo de raciocínio do Qwen3 é proibitivo na CPU. Garanta que dá para desligá-lo pelo provider escolhido e verifique na prática. |
| `AI_EMBED_MODEL` | `bge-m3` | `bge-m3` | **Obrigatoriamente o mesmo nas duas máquinas** (ver §5). |
| `AI_NUM_CTX` | `8192` | `4096` | O contexto também ocupa RAM/VRAM. |
| `AI_TOP_TABLES` | `8` | `4` | Tabelas recuperadas por pergunta. |
| `AI_MAX_COLUMNS_PER_TABLE` | `40` | `20` | Colunas por tabela enviadas ao modelo, já filtradas por relevância. |
| `AI_MAX_STEPS` | `6` | `4` | Limite de chamadas de ferramenta por pergunta. |
| `AI_MAX_FIX_ATTEMPTS` | `2` | `1` | Tentativas de autocorreção. |
| `AI_TIMEOUT_MS` | `60000` | `240000` | |

Valide as variáveis com zod no servidor, como o resto do projeto, e exponha o preset e os modelos efetivos em uma rota de status.

## 3. Stack e dependências autorizadas

- **Orquestração:** Vercel AI SDK (`ai`), com o provider do Ollama. Prefira um que permita desligar o modo de raciocínio e passar `num_ctx`: avalie `ollama-ai-provider-v2` contra `@ai-sdk/openai-compatible` apontado para `/v1` e justifique a escolha em uma linha. Para a UI, `@ai-sdk/react` só se simplificar de fato o streaming. Consulte a documentação atual do AI SDK (context7) antes de escrever código: a API mudou bastante entre versões.
- **Fase 4, opcional:** `@ai-sdk/google`, para o provider Gemini.
- **Vetores:** extensão `pgvector` no Postgres que já existe. Não crie outro banco.
- Nenhuma outra dependência sem me perguntar. Não use LangChain nem crie serviço em Python.
- Lembre do bloco do AGENTS.md: este Next.js tem mudanças incompatíveis. Leia `node_modules/next/dist/docs/` para route handlers e streaming.

## 4. Fase 1: infraestrutura

### 4.1 Ollama no compose

- Serviço `ollama` com imagem `ollama/ollama` em **versão fixada**, volume nomeado `ollama` e healthcheck.
- Porta publicada **só em loopback**: `127.0.0.1:11434:11434`, no mesmo padrão e com o mesmo tipo de comentário do Postgres. Isso existe para o `pnpm dev`, que roda no host. Nunca `11434:11434`.
- Variáveis do serviço: `OLLAMA_KEEP_ALIVE` alto (por exemplo, `30m`), `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_MAX_LOADED_MODELS=2` (chat + embeddings).
- Serviço de inicialização `ollama-pull`, que roda `ollama pull` do modelo de chat e do de embeddings contra `ollama:11434` e termina. O app depende dele com `service_completed_successfully`, como já depende do Postgres.
- O app recebe `OLLAMA_BASE_URL=http://ollama:11434` no compose. No `pnpm dev`, o valor vem do `.env` (`http://127.0.0.1:11434`).
- **GPU em arquivo à parte:** `compose.gpu.yaml` com a reserva de dispositivo NVIDIA (`deploy.resources.reservations.devices`). O desktop usa os dois arquivos; o notebook usa só o `compose.yaml`. Documente no `.env.example` como fixar isso com `COMPOSE_FILE`, lembrando que o separador no Windows é `;` (ou use `COMPOSE_PATH_SEPARATOR`).
- **Simulação do notebook:** `compose.cpu.yaml`, que tira a GPU e limita o `ollama` a `cpus: "4"` e a cerca de 8 GB de memória. Serve para medir o preset `cpu` no desktop.

### 4.2 pgvector

- A imagem atual é `postgres:18-alpine`, que não traz o pgvector. A troca natural é `pgvector/pgvector:pg18`, mas ela usa Debian/glibc, e o volume `pgdata` foi criado com musl: **a ordenação de texto (collation) muda e os índices de texto podem ficar inconsistentes**. Antes de trocar, apresente-me as opções e espere minha decisão:
  - (a) `pg_dump` → nova imagem → restore;
  - (b) nova imagem + `REINDEX DATABASE` + `ALTER DATABASE … REFRESH COLLATION VERSION`;
  - (c) imagem própria baseada na alpine compilando o pgvector.

  Lembre que o volume guarda perfis cifrados, histórico e consultas salvas.
- Migration Prisma com `CREATE EXTENSION IF NOT EXISTS vector`. Colunas vetoriais como `Unsupported("vector(N)")` no schema; inserção e busca por `$queryRaw`/`$executeRaw` com parâmetros, nunca concatenando texto. Confira na documentação do Prisma 7 como ele trata extensões do Postgres.

### 4.3 Variáveis e `.env.example`

Acrescente ao `.env.example`, com comentários explicando cada uma: `AI_PRESET` e as variáveis da §2, `OLLAMA_BASE_URL` e `COMPOSE_FILE`. O compose repassa ao app só as `AI_*` e `OLLAMA_BASE_URL`.

### 4.4 README: notebook com Windows

Explique o `.wslconfig` (`memory=12GB`, `processors=8`) e por que ele é necessário: o WSL limita a memória por padrão, e o modelo, o Postgres e o app disputam os 16 GB.

**Aceite da fase 1:** `docker compose up` sobe tudo nas duas configurações (com e sem `compose.gpu.yaml`); `ollama ps` mostra o modelo na GPU no desktop; `pnpm typecheck` passa.

## 5. Fase 2: base de conhecimento (RAG sobre o dicionário)

### 5.1 O que indexar

- **Um documento por tabela:** `NOMETAB`, `DESCRTAB` e uma lista truncada de `NOMECAMPO — DESCRCAMPO`.
- **Colunas individuais só das tabelas já recuperadas.** O TDDCAM pode ter dezenas de milhares de linhas, então não indexe todas de antemão. Gere os embeddings dessas colunas sob demanda e guarde em cache na mesma tabela de vetores.
- **Consultas salvas (`SavedQuery`):** nome + SQL, como exemplos para o prompt (few-shot). Recupere as 1–2 mais parecidas com a pergunta.
- **Busca híbrida:** combine o vetor com uma busca textual do Postgres (`tsvector` com configuração `portuguese` ou `simple`) sobre nome e descrição. Nomes de tabela do Sankhya (`TGFCAB`, `TGFPAR`…) não carregam significado para embeddings; a busca textual pega quando o usuário cita o nome. Una os dois rankings, por exemplo com reciprocal rank fusion.

Leia o dicionário pelas funções que já existem em `src/features/dictionary/server/dictionary.ts` (`listTables`, `listColumns`). Não escreva SQL novo contra o ERP.

### 5.2 Chave do índice

O índice pertence ao **ERP**, não ao perfil. A chave é a base URL normalizada do perfil ativo, porque os ids de perfil diferem entre as máquinas. Grave também o modelo de embeddings, a dimensão e a data de geração. **Se o modelo ou a dimensão do índice não baterem com `AI_EMBED_MODEL`, a busca recusa com erro claro em vez de devolver lixo.**

### 5.3 Rotas (todas com `localOnly`)

- `POST /api/ai/index`: (re)constrói o índice do perfil ativo em lotes, com progresso via streaming.
- `GET /api/ai/index`: status (quantidade, modelo, dimensão, `builtAt`, `stale`).
- A rota de refresh do dicionário marca o índice como desatualizado (`stale`), **sem reconstruir automaticamente**: na CPU isso é caro.

### 5.4 Levar o índice do desktop ao notebook

Scripts `pnpm ai:export` e `pnpm ai:import` (em `scripts/`, rodando no host contra o Postgres, como o `seed`). Eles geram e leem um arquivo NDJSON com cabeçalho (modelo, dimensão, base URL, data) e recusam importar se o modelo divergir de `AI_EMBED_MODEL`. Coloque a pasta de saída no `.gitignore` e no `.dockerignore`.

**Aceite da fase 2:** depois de indexar, uma rota ou script de depuração mostra, para 5 perguntas de exemplo, as tabelas recuperadas e os scores, com tempo de embedding da pergunta medido nos dois presets.

## 6. Fase 3: o agente e a interface (MVP)

### 6.1 Código

- Lógica pura (montagem de prompt, extração do SQL da resposta, fusão de rankings, wrapper de validação) em `src/lib/ai/`, só com `import type` entre arquivos, para rodar no Node com testes `node --test` como em `src/lib/sql/__tests__/`. Script `test:ai`.
- Integração (provider, ferramentas, rotas) em `src/features/ai/server/`, com `import "server-only"`. Componentes em `src/features/ai/components/`. As rotas em `src/app/api/ai/**/route.ts` só reexportam, como as demais.

### 6.2 Ferramentas do agente

| Ferramenta | Faz | Limite |
|---|---|---|
| `buscarTabelas(consulta)` | Busca híbrida da §5 | Até `AI_TOP_TABLES` |
| `listarColunas(tabela)` | `listColumns`, filtrando por relevância à pergunta | Até `AI_MAX_COLUMNS_PER_TABLE`; nome validado por `tableName` |
| `validarSQL(sql)` | `checkReadOnly`; se passar, executa `SELECT * FROM (<sql>) WHERE ROWNUM <= 0` via `executeQuery` | Devolve só ok ou o `statusMessage` do Oracle |

A ferramenta `validarSQL` existe para que **nenhuma linha de dado do ERP entre no prompt**. Ela só confirma que o Oracle aceita a consulta (sintaxe, tabelas e colunas existentes). O wrapper também precisa passar pela trava de leitura. Teste se ele funciona com consultas que começam com `WITH` e com `FETCH FIRST`.

### 6.3 Fluxo

1. O servidor recupera as tabelas candidatas antes da primeira chamada ao modelo e as coloca no prompt. Isso economiza uma volta, o que é crucial na CPU.
2. O modelo pode chamar as ferramentas até `AI_MAX_STEPS`.
3. A resposta final é **SQL Oracle**, uma instrução `SELECT`/`WITH`, sem `;`.
4. O servidor valida. Se falhar, devolve o erro ao modelo, até `AI_MAX_FIX_ATTEMPTS` vezes.
5. O resultado é o SQL mais a lista de tabelas usadas, as tentativas e as métricas.

### 6.4 Prompt

- Em português, curto (cada token custa na CPU), com regras de Oracle: `FETCH FIRST n ROWS ONLY` ou `ROWNUM` conforme o estilo de limite padrão, `TO_DATE` com máscara explícita, sem `;`, só leitura.
- Dicionário e exemplos entram em blocos delimitados e marcados como **dados, não instruções**. Descrições do ERP são texto livre e podem conter qualquer coisa.

### 6.5 Rotas

- `POST /api/ai/ask` (`localOnly`, zod: pergunta não vazia e de até ~2 KB). Responde em streaming com eventos de etapa: tabelas recuperadas, ferramenta chamada, tentativa n, SQL final, erro.
- **Cancelamento:** abortar a requisição no navegador aborta a chamada ao Ollama (`AbortSignal` até o provider).
- Erros tipados como os do Sankhya, por exemplo `AiUnavailableError` (Ollama fora do ar ou modelo não baixado, com a mensagem dizendo qual modelo puxar), `AiTimeoutError` e `AiIndexMissingError`. Mapeie-os em `errorResponse` ou equivalente.

### 6.6 Interface

Use os componentes shadcn que já existem em `src/components/ui/`.

- **Painel "Perguntar à IA"** na aba ativa: campo de pergunta, botão Gerar (Ctrl/Cmd+Enter dentro do campo), botão Cancelar e uma lista de etapas em tempo real, para a espera na CPU parecer andamento e não travamento.
- **Ao terminar**, o SQL vai para o editor da aba ativa marcado como "editado à mão", com as tabelas usadas visíveis. A consulta **não roda sozinha**.
- **"Corrigir com IA"** na área de erro do resultado: envia o SQL e o `statusMessage`. É o mesmo fluxo, partindo do SQL existente.
- **Selo no header** com o preset e o modelo ativos, e o estado do índice (ausente, desatualizado ou pronto, com botão para indexar).

**Aceite da fase 3:** no desktop, 3 perguntas reais geram SQL válido que roda pelo botão Rodar; no `compose.cpu.yaml`, as mesmas perguntas terminam dentro de `AI_TIMEOUT_MS` mostrando as etapas; cancelar funciona; Ollama desligado gera erro claro e não 500.

## 7. Fase 4: evolução (N3), um item por vez, perguntando antes de cada um

1. **Registro de execuções:** tabela `AiRun` com pergunta, preset, modelos, tabelas recuperadas, SQL final, sucesso, tentativas, tokens de entrada e saída, tempo de leitura do prompt e de geração (vindos do Ollama) e tempo total. **Nunca linhas do resultado.** É a base da avaliação.
2. **Avaliação:** `scripts/ai-eval.mjs` com um arquivo de casos (pergunta → tabelas esperadas, mais trechos esperados no SQL). Mede acerto de recuperação, taxa de SQL válido, tentativas e latência por preset, e gera uma tabela em Markdown. O SQL válido é verificado com a ferramenta `validarSQL`, contra o Sankhya real só quando eu pedir.
3. **Saída como `QueryState`:** modo `AI_OUTPUT=sql|state`. Com `state`, o modelo gera JSON validado por um schema zod derivado de `src/lib/sql/query-state.ts`, `toOracleSql` gera o SQL e os `problems` voltam ao modelo como erro. O resultado preenche o builder. Meça o custo em tokens contra o modo `sql` na CPU.
4. **Provider Gemini opcional:** `AI_PROVIDER=ollama|gemini`, padrão `ollama`. Desligado a menos que `AI_ALLOW_REMOTE=true` e `GEMINI_API_KEY` estejam definidos. Só saem da máquina a pergunta, trechos do dicionário e o `statusMessage`, nunca linhas (o que a §6.2 já garante). A chave entra na redação de logs, e a UI mostra claramente quando o provider remoto está ativo.

## 8. Proteções (não negociáveis)

- Todas as rotas novas passam por `localOnly`.
- O Ollama só é publicado em `127.0.0.1`.
- Nenhuma ferramenta do agente chama outra coisa do Sankhya além de `executeQuery`, sempre atrás de `checkReadOnly`.
- O agente nunca executa a consulta final; quem roda é o usuário.
- Nenhuma linha de resultado do ERP vai para o modelo, para logs ou para a `AiRun`.
- Nenhum segredo de perfil chega ao prompt ou aos logs (`redactText`/`redactHeaders`).
- Se algo exigir enfraquecer uma proteção do SPEC, pare e pergunte.

## 9. Verificação

- `pnpm typecheck`, `pnpm test:sql` e `pnpm test:ai` passando.
- Contra o **Sankhya falso** do AGENTS.md (projeto `snk-verify`, porta 3101, confira `baseUrl` em `/api/sankhya/status` antes). Para o agente, o falso precisa responder ao `TDDTAB`/`TDDCAM` com um dicionário pequeno de fixture e devolver `status != "1"` para consultas com coluna inexistente, para exercitar a autocorreção.
- Meça com `ollama ps` (GPU ou CPU) e com as métricas da `AiRun` ou dos logs, e informe os números nos dois presets ao fim das fases 2 e 3.

## 10. Ao fim de cada fase

1. Atualize o `SPEC.md` (Escopo, dependências, Rotas, Proteções, Estrutura, Verificação, Fora do escopo) e o `AGENTS.md` (dependências permitidas, comandos), mantendo o estilo atual. Eles são a fonte da verdade do repositório.
2. Acrescente uma entrada curta em `docs/agentes-de-codigo.md`: o que foi pedido, o que você gerou, refatorou, testou ou corrigiu, e decisões e problemas encontrados. Esse registro faz parte da entrega acadêmica.
3. Pare e me mostre um resumo, o que ficou pendente e os números medidos.
