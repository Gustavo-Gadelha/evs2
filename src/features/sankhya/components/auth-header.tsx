import type { Profile } from "@/features/profiles/profiles";
import type { AuthStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";

type Props = {
  status: AuthStatus | null;
  profiles: Profile[];
  activeId: string | null;
  busy: boolean;
  onOpenProfiles: () => void;
  onSelectProfile: (id: string | null) => void;
  onLogin: () => void;
  onLogout: () => void;
};

export function AuthHeader({
  status,
  profiles,
  activeId,
  busy,
  onOpenProfiles,
  onSelectProfile,
  onLogin,
  onLogout,
}: Props) {
  const authenticated = status?.authenticated ?? false;
  const hasProfile = status?.profile != null;

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-3">
      <h1 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        {/* O favicon do app (src/app/favicon.ico) é servido em /favicon.ico; é decorativo, o nome vem ao lado. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.ico" alt="" width={20} height={20} className="size-5" />
        snk-assistant
      </h1>
      <Badge className="h-4 rounded bg-amber-500/15 px-1.5 text-[10px] uppercase text-amber-300">development</Badge>
      <code className="min-w-0 truncate text-xs text-muted-foreground">
        {status?.baseUrl ?? (status ? "nenhum perfil ativo" : "…")}
      </code>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        <NativeSelect
          size="sm"
          aria-label="Perfil de acesso"
          className="w-auto max-w-48"
          value={activeId ?? ""}
          disabled={busy || profiles.length === 0}
          onChange={(event) => onSelectProfile(event.target.value || null)}
        >
          {profiles.length === 0 && <option value="">Sem perfis</option>}
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </NativeSelect>
        <Button variant="outline" size="sm" type="button" aria-haspopup="dialog" onClick={onOpenProfiles}>
          Perfis
        </Button>
        <span className="flex items-center gap-2 text-xs text-foreground">
          <span
            aria-hidden
            className={`size-2 rounded-full ${authenticated ? "bg-emerald-400" : "bg-muted-foreground/50"}`}
          />
          {authenticated
            ? `Autenticado às ${new Date(status!.authenticatedAt!).toLocaleTimeString("pt-BR")}`
            : "Sem sessão (login automático na 1ª requisição)"}
        </span>
        <Button variant="outline" size="sm" type="button" disabled={busy || !hasProfile} onClick={onLogin}>
          {authenticated ? "Relogar" : "Login"}
        </Button>
        <Button variant="outline" size="sm" type="button" disabled={busy || !authenticated} onClick={onLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
