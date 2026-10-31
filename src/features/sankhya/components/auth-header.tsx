import type { Profile } from "@/features/profiles/profiles";
import type { AuthStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { NavItem } from "@/components/nav-item";

type Props = {
  status: AuthStatus | null;
  profiles: Profile[];
  activeId: string | null;
  busy: boolean;
  dictionaryOpen: boolean;
  profilesOpen: boolean;
  onOpenDictionary: () => void;
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
  dictionaryOpen,
  profilesOpen,
  onOpenDictionary,
  onOpenProfiles,
  onSelectProfile,
  onLogin,
  onLogout,
}: Props) {
  const authenticated = status?.authenticated ?? false;
  const hasProfile = status?.profile != null;

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-3">
      <h1 className="text-sm font-semibold tracking-tight">snk-assistant</h1>
      <Badge className="h-4 rounded bg-amber-500/15 px-1.5 text-[10px] uppercase text-amber-300">local · dev-only</Badge>
      <nav aria-label="Principal" className="flex items-center gap-5">
        <NavItem
          current={dictionaryOpen}
          aria-haspopup="dialog"
          aria-expanded={dictionaryOpen}
          onClick={onOpenDictionary}
        >
          Dicionário
        </NavItem>
        <NavItem current={profilesOpen} aria-haspopup="dialog" aria-expanded={profilesOpen} onClick={onOpenProfiles}>
          Perfis
        </NavItem>
      </nav>
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
      <code className="min-w-0 truncate text-xs text-muted-foreground">
        {status?.baseUrl ?? (status ? "nenhum perfil ativo" : "…")}
      </code>

      <div className="ml-auto flex items-center gap-3">
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
