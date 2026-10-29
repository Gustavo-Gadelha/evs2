import type { AuthStatus } from "@/lib/types";

type Props = {
  status: AuthStatus | null;
  busy: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

export function AuthHeader({ status, busy, onLogin, onLogout }: Props) {
  const authenticated = status?.authenticated ?? false;

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
      <h1 className="text-sm font-semibold tracking-tight">snk-assistant</h1>
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
        local · dev-only
      </span>
      <code className="min-w-0 truncate text-xs text-zinc-400">{status?.baseUrl ?? "…"}</code>

      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-2 text-xs text-zinc-300">
          <span
            aria-hidden
            className={`size-2 rounded-full ${authenticated ? "bg-emerald-400" : "bg-zinc-600"}`}
          />
          {authenticated
            ? `Autenticado às ${new Date(status!.authenticatedAt!).toLocaleTimeString("pt-BR")}`
            : "Sem sessão (login automático na 1ª requisição)"}
        </span>
        <button type="button" className="btn" disabled={busy} onClick={onLogin}>
          {authenticated ? "Relogar" : "Login"}
        </button>
        <button type="button" className="btn" disabled={busy || !authenticated} onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
