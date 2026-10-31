import type { ChatMessage } from "@/features/assistant/protocol";
import { emptyQueryState, type QueryState } from "@/lib/sql/query-state";
import type { QueryResult } from "@/lib/types";

// Uma consulta aberta: builder, SQL, resultado e execução próprios. Só existe na memória do navegador.
export type Tab = {
  id: string;
  // Posição de criação, para o título de quem ainda não tem tabela no FROM.
  number: number;
  state: QueryState;
  sql: string;
  manual: boolean;
  result: QueryResult | null;
  error: string | null;
  running: boolean;
  // Conversa com o assistente.
  chat: ChatMessage[];
};

export function newTab(number: number): Tab {
  return {
    id: `tab-${number}`,
    number,
    state: emptyQueryState(),
    sql: "",
    manual: false,
    result: null,
    error: null,
    running: false,
    chat: [],
  };
}

export function tabTitle(tab: Tab): string {
  return tab.state.from.table.trim().toUpperCase() || `Consulta ${tab.number}`;
}
