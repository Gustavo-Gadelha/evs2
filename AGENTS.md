# snk-assistant

Builder visual de SQL Oracle, local e dev-only, que roda consultas no Sankhya (ERP) via `DbExplorerSP.executeQuery`; as credenciais ficam no servidor Next.js. Escopo e decisões: leia [`SPEC.md`](SPEC.md) antes de criar ou mudar qualquer feature.

## Regras

- **Local-only é o requisito central.** Preserve cada proteção listada em "Proteções" no `SPEC.md`; qualquer mudança que enfraqueça uma delas precisa de confirmação explícita minha.
- **Credenciais e bearer token ficam só no servidor**: código em `lib/sankhya/` começa com `import "server-only"`, e nada que as rotas devolvem ou registram em log contém esses valores (use `redactText`/`redactHeaders`).
- **Presets e features que você escrever só leem dados do ERP.** Se uma tarefa pedir chamada que grave (`save`, `insert`, `update`, `delete`, ações que alterem dados), pare e pergunte.
- `lib/sql/` só usa `import type` entre seus arquivos, para rodar direto no Node (`node arquivo.mjs` importando os `.ts`) ao verificar o gerador e a trava de leitura.
- Estilo com Tailwind puro, reaproveitando as classes `.panel`, `.input`, `.btn*` e `.label` de `app/globals.css`.
- Dependências novas além de next, react, tailwind, zod, TanStack Table/Virtual, `@dnd-kit/react`, `downshift` e `lucide-react`: pergunte antes. O TanStack Table é v9 (`useTable` + `tableFeatures`, não a API v8 `useReactTable`); consulte a documentação dele pelo context7.
- Roda só com `docker compose up`. Para checar tipos: `pnpm typecheck`.
- **Verificação contra um Sankhya falso**: o `.env.local` tem credenciais reais. Suba um projeto separado com um override que troca as variáveis `SANKHYA_*` e publica em outra porta, porque a instância do usuário pode estar ocupando a 3100 (`ports: !override ["127.0.0.1:3101:3100"]`): `docker compose -p snk-verify -f compose.yaml -f <override> up -d --force-recreate`. Depois confirme `baseUrl` em `/api/sankhya/status` antes de qualquer requisição. O container do projeto padrão pode já existir com o env real, e um `up` sem `--force-recreate` o reaproveita.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
