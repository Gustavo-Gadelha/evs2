"use client";

import { useEffect, useRef, useState } from "react";

import { profiles as api, type Profile, type ProfileInput, type ProfilesState } from "../profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const dialog = useRef<HTMLDialogElement>(null);
  // `null` = lista; `"new"` = cadastro; senão, o id do perfil em edição.
  const [editing, setEditing] = useState<string | null>(state.profiles.length === 0 ? "new" : null);
  const [form, setForm] = useState<ProfileInput>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function startNew() {
    setForm(EMPTY);
    setEditing("new");
    setError(null);
  }

  function startEdit(profile: Profile) {
    setForm({ ...EMPTY, name: profile.name, baseUrl: profile.baseUrl, username: profile.username });
    setEditing(profile.id);
    setError(null);
  }

  async function run(action: () => Promise<ProfilesState>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
      after?.();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (editing === "new") {
      void run(() => api.create(form), () => setEditing(null));
    } else if (editing) {
      const id = editing;
      void run(() => api.update(id, form), () => setEditing(null));
    }
  }

  function field(name: keyof ProfileInput, label: string, options: { secret?: boolean; type?: string } = {}) {
    const isNew = editing === "new";
    return (
      <label className="flex flex-col gap-1">
        <span className="label">{label}</span>
        <Input
          type={options.type ?? (options.secret ? "password" : "text")}
          autoComplete="off"
          required={isNew || !options.secret}
          placeholder={!isNew && options.secret ? "Em branco mantém o valor atual" : undefined}
          value={form[name]}
          onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        />
      </label>
    );
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && dialog.current.close()}
      className="m-auto w-[min(36rem,95vw)] rounded-lg border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="label">Perfis de acesso</h2>
          <Button variant="ghost" size="xs" type="button" className="ml-auto" aria-label="Fechar" onClick={() => dialog.current?.close()}>
            ✕
          </Button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}

        {editing === null ? (
          <>
            <ul className="flex flex-col gap-1">
              {state.profiles.map((profile) => (
                <li key={profile.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-zinc-800">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      {profile.name}
                      {profile.id === state.activeId && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                          ativo
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-zinc-400">
                      {profile.username} · {profile.baseUrl}
                    </div>
                  </div>
                  {confirmDelete === profile.id ? (
                    <>
                      <Button
                        variant="outline" size="sm"
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => api.remove(profile.id), () => setConfirmDelete(null))}
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
                          onClick={() => void run(() => api.activate(profile.id))}
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
                <li className="px-2 py-1 text-xs text-zinc-500">Nenhum perfil cadastrado.</li>
              )}
            </ul>
            <Button variant="outline" size="sm" type="button" className="self-start" onClick={startNew}>
              Novo perfil
            </Button>
          </>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submit}>
            {field("name", "Nome")}
            {field("baseUrl", "Base URL", { type: "url" })}
            {field("appkey", "Appkey", { secret: true })}
            {field("token", "Token", { secret: true })}
            {field("username", "Usuário")}
            {field("password", "Senha", { secret: true })}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" type="submit" disabled={busy}>
                Salvar
              </Button>
              {(state.profiles.length > 0 || editing !== "new") && (
                <Button variant="outline" size="sm" type="button" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
