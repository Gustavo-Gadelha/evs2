"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Option<T extends string> = { value: T; label?: string };

type Props<T extends string> = {
  label: string;
  value: T;
  options: readonly (T | Option<T>)[];
  onChange: (value: T) => void;
  className?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  icon?: ReactNode;
  // Texto do botão quando `value` não corresponde a nenhuma opção.
  placeholder?: string;
  disabled?: boolean;
  align?: "start" | "center" | "end";
  contentClassName?: string;
  // Itens em fonte monoespaçada (operadores, palavras-chave SQL); desligue para nomes comuns.
  mono?: boolean;
};

// Menu de escolha única no mesmo estilo do menu ƒ (DropdownMenu), no lugar do <select> nativo.
export function OptionMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
  variant = "outline",
  size = "sm",
  icon,
  placeholder,
  disabled,
  align = "start",
  contentClassName = "max-h-80 min-w-32",
  mono = true,
}: Props<T>) {
  const items = options.map((option) => (typeof option === "string" ? { value: option, label: option } : option));
  const current = items.find((item) => item.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={variant}
            size={size}
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            className={`shrink-0 justify-between gap-1.5 font-normal ${className}`}
          />
        }
      >
        {icon}
        <span className="truncate">{current ? (current.label ?? current.value) : (placeholder ?? value)}</span>
        <ChevronDownIcon className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={contentClassName}>
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as T)}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              <span className={mono ? "font-mono text-xs" : undefined}>{item.label ?? item.value}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
