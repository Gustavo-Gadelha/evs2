"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        onKeyDown={(event) => event.key === "Escape" && setOpen(false)}
      />
      <Button variant="outline" size="sm" type="submit" disabled={!name.trim()}>
        Salvar
      </Button>
    </form>
  );
}
