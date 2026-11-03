// Baixa o modelo de chat do preset (`pnpm ai:pull-chat`), executando `ollama pull` no container `ollama`.

import { pullModel } from "./ai-pull-lib.mjs";

pullModel("chat");
