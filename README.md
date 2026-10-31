# snk-assistant

Builder visual de SQL Oracle que roda consultas no Sankhya via `DbExplorerSP.executeQuery`: monte a consulta em formulários, ajuste o SQL à mão se quiser, veja o resultado em tabela e salve o que for útil. As credenciais ficam só no servidor Next.js; o navegador fala apenas com as rotas `/api/sankhya/*`.

## ⚠️ Ferramenta local

- Roda **só** na sua máquina, **só** para você, via Docker Compose (build standalone de produção) ou via `pnpm dev`, que escuta apenas em `127.0.0.1:3100`. Não há script `start` e `pnpm build` só serve ao Dockerfile.
- A porta é publicada apenas no loopback (`127.0.0.1:3100`). Não troque por `"3100:3100"`: isso expõe a ferramenta, e a sessão autenticada no Sankhya, a qualquer um na rede.
- As rotas da API recusam requisições com `Host` ou `Origin` que não sejam `localhost`/`127.0.0.1`.
- Só leitura: o servidor aceita uma única instrução `SELECT`/`WITH` e recusa `;`, DML, DDL e PL/SQL. É uma checagem léxica: ela não impede uma função PL/SQL que grave de ser chamada dentro de um SELECT.
- Nunca faça deploy, nunca publique a porta em outra interface, nunca use `NEXT_PUBLIC_` nas credenciais.

## Setup

1. Instale o Docker (Docker Desktop no Windows/macOS) para o modo Docker; para o `pnpm dev`, instale Node 26 e pnpm 12 e rode `pnpm install`. O banco é um Postgres 18 que sobe pelo próprio compose, nos dois modos.
2. Copie `.env.example` para `.env`, troque a senha do Postgres (`POSTGRES_PASSWORD` e a mesma senha dentro de `DATABASE_URL`) e gere a `ENCRYPTION_KEY` (o comando está no arquivo). Os perfis do Sankhya são cadastrados pela tela (ou pelo perfil padrão, passo 3): ao abrir o app, clique em **Perfis** e cadastre um perfil (nome, base URL, appkey, token, usuário e senha). Cadastre quantos quiser e escolha o ativo no seletor do header; trocar de perfil encerra a sessão do anterior e o login do novo acontece na primeira requisição. Os segredos ficam no Postgres, cifrados (AES-256-GCM) com a chave `ENCRYPTION_KEY` do `.env`, fora do banco; nunca voltam ao navegador. Ao editar um perfil, appkey, token e senha em branco mantêm o valor atual.
3. (Opcional) **Perfil padrão**: para não digitar o perfil na tela, preencha as seis variáveis `SANKHYA_PROFILE_NAME`, `_BASE_URL`, `_APPKEY`, `_TOKEN`, `_USERNAME` e `_PASSWORD` no `.env`, suba o Postgres (`docker compose up -d postgres`) e rode `pnpm seed`. O comando só age se as seis estiverem preenchidas: sem nenhuma, não faz nada; com só algumas, falha apontando as que faltam. Ele cria o perfil, cifrando os segredos como o cadastro pela tela, ou atualiza o de mesmo nome com os valores atuais do `.env`; o perfil vira o ativo apenas se ainda não houver um ativo. Se o app já estiver rodando, reinicie-o depois (`docker compose restart snk-assistant`), porque ele guarda os perfis em memória. O compose não repassa essas variáveis ao container: elas só são lidas pelo `pnpm seed`, no host.

## Uso

```sh
pnpm dev               # desenvolvimento, com hot reload
docker compose up      # abre em http://localhost:3100
pnpm seed              # opcional: cria o perfil padrão a partir das SANKHYA_PROFILE_* do .env
pnpm test:sql          # testes do gerador de SQL, da trava de leitura e do JOIN do dicionário (node --test)
pnpm format            # formata o código com o Prettier (format:check só confere)
docker compose down    # para (os dados ficam no volume `pgdata`; `down -v` apaga perfis, histórico e consultas salvas)
```

Com `pnpm dev` há hot reload, em `http://localhost:3100`; ele usa o Postgres do compose (`docker compose up -d postgres`, porta `POSTGRES_PORT` em `127.0.0.1`), aplica as migrations e compartilha o banco com o modo Docker. Não rode os dois ao mesmo tempo (mesma porta).

No Docker não há hot reload: depois de mudar o código ou as dependências, rode `docker compose up --build`. O `entrypoint.sh` do container aplica as migrations do Prisma no Postgres a cada subida, depois que ele fica saudável. Os dados ficam no volume `pgdata`.

- **Login** é automático na primeira requisição. O botão Login força um novo login; Logout encerra a sessão no Sankhya. Um 401 dispara um novo login e uma única nova tentativa.
- **Abas**: cada aba tem builder, SQL e resultado próprios (só na memória: recarregar a página volta a uma aba em branco). "+" ou "Nova consulta" abre uma aba; o botão direito numa aba fecha uma, as outras, as da direita, as da esquerda ou todas. Uma consulta que termina depois de você trocar de aba grava o resultado na aba certa.
- **Builder**: FROM, JOINs, SELECT (colunas e agregações), WHERE com grupos AND/OR aninhados, GROUP BY (automático ou manual), HAVING, ORDER BY e limite (`FETCH NEXT` para 12c+, `ROWNUM` para 11g). O botão ƒ ao lado de cada expressão insere funções Oracle, envolvendo o texto selecionado.
- **Editor SQL**: acompanha o builder até você editar à mão; depois disso, "↺ regenerar do builder" descarta a edição (com confirmação). **Ctrl/Cmd+Enter** roda o texto do editor da aba ativa. O editor (CodeMirror) destaca a sintaxe Oracle, sugere tabelas e colunas do dicionário (inclusive pelos aliases do FROM/JOIN).
- **Assistente**: o seletor "Builder | Assistente", na barra lateral abaixo do botão Dicionário, troca o builder por uma conversa que sugere SQL (cada aba de consulta tem a sua). Os blocos de SQL da resposta têm "Usar no editor", "Abrir em nova aba" e "Copiar"; o assistente nunca roda a consulta, e blocos que não passam na trava de leitura ficam bloqueados. Por enquanto a resposta é simulada: a integração com o Ollama local ainda não existe.
- **Dicionário** (botão na barra lateral): busca tabelas do `TDDTAB`; a tabela escolhida mostra as colunas com tipo, tamanho e valores de domínio, e os relacionamentos com outras tabelas. "Ver 20 linhas" monta um `SELECT` da tabela e "JOIN" acrescenta ao builder o JOIN de um relacionamento (a tabela precisa estar no FROM ou num JOIN). "Atualizar do ERP" descarta o cache.
- **Resultado**: tabela virtualizada (aguenta dezenas de milhares de linhas) com ordenação por coluna, busca global, filtro por coluna (sem diferenciar maiúsculas e acentos) e menu para ocultar colunas; também JSON bruto e "Copiar CSV" com o resultado completo. Erros do Oracle aparecem com a mensagem original.
- **Histórico**: as últimas 200 execuções ficam no Postgres (volume Docker `pgdata`, fora do repositório); o resultado só é guardado se tiver até 5 MB. Clicar numa entrada (ou numa consulta salva) a carrega na aba ativa, substituindo o que havia nela. O botão direito numa entrada do histórico oferece Abrir, Abrir em nova aba, Salvar como consulta e Excluir; as consultas salvas também ficam no Postgres.
