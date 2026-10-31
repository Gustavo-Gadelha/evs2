"use client";

import { useRef } from "react";

import { ORACLE_FUNCTIONS, applyTemplate } from "@/lib/sql/functions";
import { Combobox } from "@/components/combobox";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDictionary } from "@/features/dictionary/components/dictionary-provider";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

// Campo de expressão SQL livre com o menu ƒ, que insere um modelo de função Oracle no cursor
// (envolvendo o texto selecionado, se houver).
export function ExprInput({ label, value, onChange, placeholder, className = "" }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const { columns } = useDictionary();

  function insert(template: string) {
    const input = ref.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const text = applyTemplate(template, value.slice(start, end));
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start, start + text.length);
    });
  }

  return (
    <div className={`flex min-w-0 ${className}`}>
      <Combobox
        inputRef={ref}
        label={label}
        className="min-w-0 flex-1"
        inputClassName="rounded-r-none font-mono"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        getItems={columns}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label={`Inserir função Oracle em ${label}`}
              title="Inserir função Oracle"
              className="shrink-0 rounded-l-none border-l-0 font-mono text-sm"
            />
          }
        >
          ƒ
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 w-72" finalFocus={ref}>
          {ORACLE_FUNCTIONS.map((fn) => {
            const [name, description] = fn.label.split(": ");
            return (
              <DropdownMenuItem key={fn.label} onClick={() => insert(fn.template)}>
                <span className="font-mono text-xs font-medium">{name}</span>
                {description && <span className="ml-auto truncate text-xs text-muted-foreground">{description}</span>}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
