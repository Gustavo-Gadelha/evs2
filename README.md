# snk-assistant

Builder visual de SQL Oracle que roda consultas no Sankhya via `DbExplorerSP.executeQuery`: monte a consulta em formulários, ajuste o SQL à mão se quiser, veja o resultado em tabela e salve o que for útil. As credenciais ficam só no servidor Next.js; o navegador fala apenas com as rotas `/api/sankhya/*`.

## ⚠️ Ferramenta local, dev-only

- Roda **só** na sua máquina, **só** para você, **só** via Docker Compose. Não há build de produção: `pnpm dev`, `pnpm build` e `pnpm start` saem com erro de propósito.
- A porta é publicada apenas no loopback (`127.0.0.1:3100`). Não troque por `"3100:3100"`: isso expõe a ferramenta, e a sessão autenticada no Sankhya, a qualquer um na rede.
- As rotas da API respondem 404 fora de `NODE_ENV=development` e recusam requisições com `Host` ou `Origin` que não sejam `localhost`/`127.0.0.1`.
- Só leitura: o servidor aceita uma única instrução `SELECT`/`WITH` e recusa `;`, DML, DDL e PL/SQL. É uma checagem léxica: ela não impede uma função PL/SQL que grave de ser chamada dentro de um SELECT.
- Nunca faça deploy, nunca publique a porta em outra interface, nunca use `NEXT_PUBLIC_` nas credenciais.

## Setup

1. Instale o Docker (Docker Desktop no Windows/macOS). Não precisa de Node no host.
2. Crie o arquivo de credenciais:

   ```sh
   cp .env.example .env.local
   ```

   Preencha `SANKHYA_BASE_URL`, `SANKHYA_APPKEY`, `SANKHYA_TOKEN`, `SANKHYA_USERNAME` e `SANKHYA_PASSWORD`. Se faltar alguma, o servidor não sobe e diz qual.

## Uso

```sh
docker compose up      # abre em http://localhost:3100
docker compose down    # para
```

Depois de mudar dependências, rode `docker compose up --build`; o container também roda `pnpm install` a cada subida para manter o volume de `node_modules` em dia.

- **Login** é automático na primeira requisição. O botão Login força um novo login; Logout encerra a sessão no Sankhya. Um 401 dispara um novo login e uma única nova tentativa.
- **Builder**: FROM, JOINs, SELECT (colunas e agregações), WHERE com grupos AND/OR aninhados, GROUP BY (automático ou manual), HAVING, ORDER BY e limite (`FETCH NEXT` para 12c+, `ROWNUM` para 11g). O botão ƒ ao lado de cada expressão insere funções Oracle, envolvendo o texto selecionado.
- **Editor SQL**: acompanha o builder até você editar à mão; depois disso, "↺ regenerar do builder" descarta a edição (com confirmação). **Ctrl/Cmd+Enter** roda o texto do editor.
- **Resultado**: tabela virtualizada (aguenta dezenas de milhares de linhas) com ordenação por coluna, busca global, filtro por coluna (sem diferenciar maiúsculas e acentos) e menu para ocultar colunas; também JSON bruto e "Copiar CSV" com o resultado completo. Erros do Oracle aparecem com a mensagem original.
- **Modelos**: edite [`presets.ts`](presets.ts) para adicionar os seus.
- **Histórico**: as últimas 50 execuções ficam no `localStorage` do navegador (o resultado só é guardado se tiver até ~200 KB). Qualquer item pode virar consulta salva.

Se o hot reload não perceber mudanças nos arquivos (comum com bind mounts no Docker Desktop), reinicie com `docker compose restart`.
