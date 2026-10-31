"use client";

import { useState } from "react";

import { profiles as api, type Profile, type ProfileInput, type ProfilesState } from "../profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";

type Props = {
  state: ProfilesState;
  onChange: (state: ProfilesState) => void;
  onClose: () => void;
};

const EMPTY: ProfileInput = {
  name: "",
  baseUrl: "https://api.sankhya.com.br",
  appkey: "",
  token: "",
  username: "",
  password: "",
};

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Cadastro de perfis de acesso. Appkey, token e senha nunca voltam do servidor: na edição, em branco = manter.
export function ProfilesDialog({ state, onChange, onClose }: Props) {
  // `null` = lista; `"new"` = cadastro; senão, o id do perfil em edição.
  const [editing, setEditing] = useState<string | null>(state.profiles.length === 0 ? "new" : null);
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startNew() {
    setForm(EMPTY);
    setEditing("new");
  }

  function startEdit(profile: Profile) {
    setForm({ ...EMPTY, name: profile.name, baseUrl: profile.baseUrl, username: profile.username });
    setEditing(profile.id);
  }

  async function run(action: () => Promise<ProfilesState>, success: string, after?: () => void) {
    setBusy(true);
    try {
      onChange(await action());
      toast.success(success);
      after?.();
    } catch (err) {
      toast.error("Não foi possível concluir", { description: messageOf(err) });
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (editing === "new") {
      void run(() => api.create(form), "Perfil salvo", () => setEditing(null));
    } else if (editing) {
      const id = editing;
      void run(() => api.update(id, form), "Perfil salvo", () => setEditing(null));
    }
  }

  function field(name: keyof ProfileInput, label: string, options: { secret?: boolean; type?: string } = {}) {
    const isNew = editing === "new";
    return (
      <Field>
        <FieldLabel htmlFor={`profile-${name}`} className="label">
          {label}
        </FieldLabel>
        <Input
          id={`profile-${name}`}
          type={options.type ?? (options.secret ? "password" : "text")}
          autoComplete="off"
          required={isNew || !options.secret}
          placeholder={!isNew && options.secret ? "Em branco mantém o valor atual" : undefined}
          value={form[name]}
          onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        />
      </Field>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex flex-col gap-3 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="label">Perfis de acesso</DialogTitle>
        </DialogHeader>

        {editing === null ? (
          <>
            <ul className="flex flex-col gap-1">
              {state.profiles.map((profile) => (
                <li key={profile.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      {profile.name}
                      {profile.id === state.activeId && (
                        <Badge className="h-4 rounded bg-emerald-500/15 px-1.5 text-[10px] uppercase text-emerald-300">ativo</Badge>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {profile.username} · {profile.baseUrl}
                    </div>
                  </div>
                  {confirmDelete === profile.id ? (
                    <>
                      <Button
                        variant="outline" size="sm"
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => api.remove(profile.id), "Perfil excluído", () => setConfirmDelete(null))}
                      >
                        Confirmar exclusão
                      </Button>
                      <Button variant="outline" size="sm" type="button" onClick={() => setConfirmDelete(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      {profile.id !== state.activeId && (
                        <Button
                          variant="outline" size="sm"
                          type="button"
                          disabled={busy}
                          onClick={() => void run(() => api.activate(profile.id), `Perfil ativo: ${profile.name}`)}
                        >
                          Usar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" type="button" onClick={() => startEdit(profile)}>
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" type="button" onClick={() => setConfirmDelete(profile.id)}>
                        Excluir
                      </Button>
                    </>
                  )}
                </li>
              ))}
              {state.profiles.length === 0 && (
                <li className="px-2 py-1 text-xs text-muted-foreground">Nenhum perfil cadastrado.</li>
              )}
            </ul>
            <Button variant="outline" size="sm" type="button" className="self-start" onClick={startNew}>
              Novo perfil
            </Button>
          </>
        ) : (
          <form onSubmit={submit}>
          <FieldGroup className="gap-3">
              {field("name", "Nome")}
              {field("baseUrl", "Base URL", { type: "url" })}
              {field("appkey", "Appkey", { secret: true })}
              {field("token", "Token", { secret: true })}
              {field("username", "Usuário")}
              {field("password", "Senha", { secret: true })}
              <Field orientation="horizontal">
                <Button variant="outline" size="sm" type="submit" disabled={busy}>
                  Salvar
                </Button>
                {(state.profiles.length > 0 || editing !== "new") && (
                  <Button variant="outline" size="sm" type="button" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                )}
              </Field>
          </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
