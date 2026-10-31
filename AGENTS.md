# snk-assistant

Builder visual de SQL Oracle, local e dev-only, que roda consultas no Sankhya (ERP) via `DbExplorerSP.executeQuery`; as credenciais ficam no servidor Next.js. Escopo e decisões: leia [`SPEC.md`](SPEC.md) antes de criar ou mudar qualquer feature.

## Regras

- **Local-only é o requisito central.** Preserve cada proteção listada em "Proteções" no `SPEC.md`; qualquer mudança que enfraqueça uma delas precisa de confirmação explícita minha.
- **Credenciais e bearer token ficam só no servidor**: todo arquivo em `src/features/*/server/` e `src/lib/db/` começa com `import "server-only"`, e nada que as rotas devolvem ou registram em log contém esses valores (use `redactText`/`redactHeaders`).
- **Features que você escrever só leem dados do ERP.** Se uma tarefa pedir chamada que grave (`save`, `insert`, `update`, `delete`, ações que alterem dados), pare e pergunte.
- `src/app/` é só roteamento: cada `route.ts` reexporta o handler de `src/features/<feature>/server/`. A lógica fica nas features (`src/features/`) e no que é compartilhado (`src/lib/`, `src/components/`).
- `src/lib/sql/` só usa `import type` entre seus arquivos, para rodar direto no Node (`node arquivo.mjs` importando os `.ts`) ao verificar o gerador e a trava de leitura.
- Interface com shadcn/ui (preset `base-nova`, sobre Base UI: use `render`, não `asChild`), com os componentes em `src/components/ui/` (adicione com `pnpm dlx shadcn@latest add <nome>` e consulte a API pelo context7). Cores e bordas pelos tokens do tema (`bg-card`, `text-muted-foreground`, `border-border`, `text-destructive`...), não `zinc-*`; Tailwind para o layout e a classe `.label` de `src/app/globals.css` para títulos de seção. Mantenha os `<select>` nativos (`NativeSelect`), o autocomplete em Downshift (`src/components/combobox.tsx`) e a tabela de resultados em TanStack Table/Virtual (sem o `Table` do shadcn).
- Avisos, erros e confirmações aparecem como toasts do `sonner` (`toast.error`/`warning`/`success`, com `id` fixo nos que podem se repetir); o `Toaster` fica em `explorer.tsx`. O erro da consulta fica só no painel de resultado e a validação em tempo real (trava de leitura, problemas do gerador) fica inline.
- Dependências novas além de next, react, tailwind, zod, TanStack Table/Virtual, `@dnd-kit/react`, `downshift`, `lucide-react`, shadcn (`@base-ui/react`, `class-variance-authority`, `cn`, `tw-animate-css`, `shadcn`) e `sonner`: pergunte antes. O TanStack Table é v9 (`useTable` + `tableFeatures`, não a API v8 `useReactTable`); consulte a documentação dele pelo context7.
- Roda com `docker compose up` ou `pnpm dev` (só em `127.0.0.1:3100`; nunca troque o hostname). O banco é o Postgres do compose, configurado pelo `.env` (copie de `.env.example`); o `pnpm dev` precisa dele no ar (`docker compose up -d postgres`). `pnpm seed` cria o perfil padrão a partir das `SANKHYA_PROFILE_*` do `.env` (opcional; nunca o rode nem leia esses valores na verificação, pois são credenciais reais). Mudou o `schema.prisma`: crie uma migration em `prisma/migrations/` (conversões de coluna levam `USING`, nunca DROP/ADD). Para checar tipos: `pnpm typecheck`.
- **Verificação contra um Sankhya falso**: os perfis do usuário têm credenciais reais. Suba um projeto separado com um override que publica em outra porta, porque a instância do usuário pode estar ocupando a 3100 (`ports: !override ["127.0.0.1:3101:3100"]`): `docker compose -p snk-verify -f compose.yaml -f <override> up -d --force-recreate`. Ele usa um volume `pgdata` próprio (sem os perfis reais) e lê o mesmo `.env`; o override também precisa mudar a porta do Postgres (`postgres: ports: !override ["127.0.0.1:5433:5432"]`): cadastre nele um perfil apontando para o Sankhya falso e confirme `baseUrl` em `/api/sankhya/status` antes de qualquer requisição. Com `pnpm dev`, o banco é o Postgres do compose do usuário (mesmos perfis reais); não ative um perfil real durante a verificação.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
