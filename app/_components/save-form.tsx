"use client";

import { useState } from "react";

type Props = {
  label: string;
  onSave: (name: string) => void;
};

// Botão que vira um campo de nome inline para salvar uma consulta.
export function SaveForm({ label, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setOpen(false);
  }

  return (
    <form
      className="flex gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <input
        autoFocus
        className="input w-40"
        placeholder="nome da consulta"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      />
      <button type="submit" className="btn" disabled={!name.trim()}>
        Salvar
      </button>
    </form>
  );
}
