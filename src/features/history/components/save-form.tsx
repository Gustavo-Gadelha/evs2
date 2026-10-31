"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  label: string;
  onSave: (name: string) => void;
  // Abre já com o campo de nome (usado pelo menu de contexto do histórico).
  defaultOpen?: boolean;
  // Chamado ao salvar ou cancelar com Escape.
  onDone?: () => void;
};

// Botão que vira um campo de nome inline para salvar uma consulta.
export function SaveForm({ label, onSave, defaultOpen = false, onDone }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [name, setName] = useState("");

  if (!open) {
    return (
      <Button variant="ghost" size="xs" type="button" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName("");
    setOpen(false);
    onDone?.();
  }

  return (
    <form
      className="flex gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Input
        autoFocus
        className="w-40"
        placeholder="nome da consulta"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          setOpen(false);
          onDone?.();
        }}
      />
      <Button variant="outline" size="sm" type="submit" disabled={!name.trim()}>
        Salvar
      </Button>
    </form>
  );
}
