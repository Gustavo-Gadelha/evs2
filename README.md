# snk-assistant

Builder visual de SQL Oracle que roda consultas no Sankhya via `DbExplorerSP.executeQuery`: monte a consulta em formulários, ajuste o SQL à mão se quiser, veja o resultado em tabela e salve o que for útil. As credenciais ficam só no servidor Next.js; o navegador fala apenas com as rotas `/api/sankhya/*`.

## ⚠️ Ferramenta local

- Roda **só** na sua máquina, **só** para você, via Docker Compose (build standalone de produção) ou via `pnpm dev`, que escuta apenas em `127.0.0.1:3100`. Não há script `start` e `pnpm build` só serve ao Dockerfile.
- A porta é publicada apenas no loopback (`127.0.0.1:3100`). Não troque por `"3100:3100"`: isso expõe a ferramenta, e a sessão autenticada no Sankhya, a qualquer um na rede.
- As rotas da API recusam requisições com `Host` ou `Origin` que não sejam `localhost`/`127.0.0.1`.
- Só leitura: o servidor aceita uma única instrução `SELECT`/`WITH` e recusa `;`, DML, DDL e PL/SQL. É uma checagem léxica: ela não impede uma função PL/SQL que grave de ser chamada dentro de um SELECT.
- Nunca faça deploy, nunca publique a porta em outra interface, nunca use `NEXT_PUBLIC_` nas credenciais.

## Setup

1. Instale o Docker (Docker Desktop no Windows/macOS) para o modo Docker; para o `pnpm dev`, instale Node 26 e pnpm 12 e rode `pnpm install`.
2. Não há arquivo de credenciais: ao abrir o app, clique em **Perfis** e cadastre um perfil (nome, base URL, appkey, token, usuário e senha). Cadastre quantos quiser e escolha o ativo no seletor do header; trocar de perfil encerra a sessão do anterior e o login do novo acontece na primeira requisição. Os segredos ficam no SQLite, cifrados (AES-256-GCM) com uma chave gerada em `snk-assistant.key`, ao lado do banco (`prisma/` no `pnpm dev`, volume `data` no Docker); nunca voltam ao navegador. Ao editar um perfil, appkey, token e senha em branco mantêm o valor atual.

## Uso

```sh
pnpm dev               # desenvolvimento, com hot reload
docker compose up      # abre em http://localhost:3100
docker compose down    # para
```

Com `pnpm dev` há hot reload, em `http://localhost:3100`; ele aplica as migrations e guarda o histórico em `prisma/dev.db` (ignorado pelo git), separado do volume do Docker. Não rode os dois ao mesmo tempo (mesma porta).

No Docker não há hot reload: depois de mudar o código ou as dependências, rode `docker compose up --build`. O serviço `migrate` aplica as migrations do Prisma no volume `data` a cada subida.

- **Login** é automático na primeira requisição. O botão Login força um novo login; Logout encerra a sessão no Sankhya. Um 401 dispara um novo login e uma única nova tentativa.
- **Builder**: FROM, JOINs, SELECT (colunas e agregações), WHERE com grupos AND/OR aninhados, GROUP BY (automático ou manual), HAVING, ORDER BY e limite (`FETCH NEXT` para 12c+, `ROWNUM` para 11g). O botão ƒ ao lado de cada expressão insere funções Oracle, envolvendo o texto selecionado.
- **Editor SQL**: acompanha o builder até você editar à mão; depois disso, "↺ regenerar do builder" descarta a edição (com confirmação). **Ctrl/Cmd+Enter** roda o texto do editor.
- **Resultado**: tabela virtualizada (aguenta dezenas de milhares de linhas) com ordenação por coluna, busca global, filtro por coluna (sem diferenciar maiúsculas e acentos) e menu para ocultar colunas; também JSON bruto e "Copiar CSV" com o resultado completo. Erros do Oracle aparecem com a mensagem original.
- **Histórico**: as últimas 200 execuções ficam num SQLite (volume Docker `data`, fora do repositório); o resultado só é guardado se tiver até 5 MB. Qualquer item pode virar consulta salva, e as consultas salvas também ficam no SQLite.
