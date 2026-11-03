# Registro do trabalho com agentes de código

## Agente de IA local — Fase 1 (infraestrutura)

**Pedido:** `docs/prompts/agente-ia.md`, fase 1: Ollama no compose, pgvector, presets `gpu`/`cpu`, variáveis `AI_*`, README para o notebook com Windows.

**Gerado:**

- `compose.yaml`: serviços `ollama` (0.40.13, loopback, healthcheck, volume `ollama`) e `ollama-pull` (baixa chat e embeddings do preset; o app depende dele com `service_completed_successfully`); Postgres trocado por `pgvector/pgvector:pg18`.
- `compose.gpu.yaml` (reserva NVIDIA) e `compose.cpu.yaml` (4 CPUs, 8 GB) para medir o preset `cpu` no desktop.
- Migration `20261101000000_pgvector` (`CREATE EXTENSION vector`).
- `src/features/assistant/server/config.ts` (presets + zod; o compose repassa variáveis vazias, tratadas como ausentes) e `GET /api/assistant/status`.
- `.env.example`, README (preset, `.wslconfig`, migração do volume) e SPEC/AGENTS atualizados.

**Decisões:**

- Troca de imagem do Postgres pela opção (a), `pg_dump` + restore em volume novo: a imagem Debian muda a collation e o volume guarda perfis cifrados e histórico.
- Mantido o nome `assistant` (já existe o stub de chat) em vez do `ai` do prompt.
- Nenhuma dependência npm nova nesta fase; `ai` e o provider entram na fase 3.

**Verificação:** `docker compose config` válido com `compose.yaml` sozinho, com `compose.gpu.yaml` e com `compose.cpu.yaml`; `pnpm typecheck` e Prettier passam.

**Pendente:** subir de fato os serviços (`ollama ps` na GPU, `ollama-pull`, migration `vector`) e medir os presets; a troca do volume `pgdata` real depende do usuário.

## Agente de IA local — Fase 2 (base de conhecimento)

**Pedido:** fase 2 do `docs/prompts/agente-ia.md`, depois de renomear `compose.cpu-sim.yaml` para `compose.cpu.yaml` (referências atualizadas) e de o usuário fazer o backup do banco.

**Gerado:**

- Migration `20261102000000_ai_index` (`unaccent`, `AiIndex`, `AiDocument` com coluna `vector` sem dimensão fixa, para não amarrar o modelo) e models no `schema.prisma`.
- `src/lib/ai/` (puro, testado com `pnpm test:ai`, 8 testes): `fusion.ts` (reciprocal rank fusion), `documents.ts` (documentos, base URL normalizada, termos do `to_tsquery`), `errors.ts` (`AiError` e derivados; `errorResponse` os mapeia).
- `src/features/assistant/server/`: `ollama.ts` (embeddings), `index-store.ts` (SQL cru parametrizado), `indexer.ts` (reconstrução em lotes, uma por vez; colunas sob demanda), `search.ts` (busca híbrida), `indexing.ts` (`GET/POST /api/assistant/index`), `search-debug.ts` (`GET /api/assistant/search?q=`).
- O refresh do dicionário marca o índice como `stale`.
- `scripts/ai-export.mjs` e `ai-import.mjs`; `ai-export/` no `.gitignore` e `.dockerignore`.

**Decisões:**

- O documento de tabela leva só nome e descrição, sem a lista de colunas do prompt: obtê-la exigiria uma chamada ao ERP por tabela (milhares). As colunas entram no índice sob demanda, para as tabelas recuperadas.
- Reindexar apaga também as colunas em cache (o dicionário pode ter mudado). Cancelar no meio deixa o índice marcado `stale`, com `dimension` 0, e a busca o trata como ausente.
- Mensagens de erro de Ollama indisponível e modelo não baixado já vêm tipadas (`AiUnavailableError`, `AiTimeoutError`), antecipando a fase 3.

**Verificação:** `pnpm typecheck`, `test:ai` (8) e `test:sql` (41) passam. Num Postgres isolado (`snk-verify`, volume próprio) as 3 migrations aplicam; as consultas de vetor, texto sem acento e prefixo de coluna retornam o esperado com vetores de 3 dimensões; `ai:export` e `ai:import` fazem o ciclo completo e o import recusa modelo diferente.

**Pendente:** o critério de aceite da fase (5 perguntas com tabelas, scores e tempo de embedding nos dois presets) exige o `bge-m3` baixado no Ollama e um Sankhya falso com `TDDTAB`/`TDDCAM`, que ainda não existe no repositório. Não rodei o fluxo completo (indexar pela rota, `/api/assistant/search`).
