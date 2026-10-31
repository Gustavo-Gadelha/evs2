import "server-only";

export type UpstreamResponse = {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Record<string, string>;
  body: unknown;
};

export class SankhyaError extends Error {
  // Status HTTP que as rotas devolvem ao navegador quando não há resposta do Sankhya para repassar.
  readonly httpStatus: number = 502;

  constructor(message = "Falha na comunicação com o Sankhya.", options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class SankhyaClientError extends SankhyaError {
  readonly response?: UpstreamResponse;

  constructor(
    message = "O Sankhya rejeitou a requisição.",
    options?: ErrorOptions & { response?: UpstreamResponse },
  ) {
    super(message, options);
    this.response = options?.response;
  }
}

export class SankhyaAuthError extends SankhyaError {
  constructor(message = "Falha na autenticação com o Sankhya.", options?: ErrorOptions) {
    super(message, options);
  }
}

export class SankhyaTimeoutError extends SankhyaError {
  override readonly httpStatus = 504;

  constructor(message = "Tempo limite excedido ao comunicar com o Sankhya.", options?: ErrorOptions) {
    super(message, options);
  }
}

// O gateway respondeu, mas a consulta falhou: a mensagem do Oracle vem em `statusMessage`.
export class SankhyaQueryError extends SankhyaError {
  override readonly httpStatus = 422;

  constructor(message = "A consulta falhou no Sankhya.", options?: ErrorOptions) {
    super(message, options);
  }
}

// Nenhum perfil de acesso ativo: não há credenciais para falar com o Sankhya.
export class NoActiveProfileError extends SankhyaError {
  override readonly httpStatus = 409;

  constructor(message = "Nenhum perfil ativo. Cadastre e selecione um perfil de acesso.", options?: ErrorOptions) {
    super(message, options);
  }
}

export function isTimeout(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError";
}
