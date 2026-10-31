"use client";

import { useRef } from "react";

import { ORACLE_FUNCTIONS, applyTemplate } from "@/lib/sql/functions";
import { Combobox } from "@/components/combobox";
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
      <select
        aria-label={`Inserir função Oracle em ${label}`}
        title="Inserir função Oracle"
        className="h-8 w-9 shrink-0 appearance-none rounded-lg rounded-l-none border border-l-0 border-input bg-transparent px-1 text-center text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        value=""
        onChange={(event) => {
          const fn = ORACLE_FUNCTIONS.find((item) => item.label === event.target.value);
          if (fn) insert(fn.template);
        }}
      >
        <option value="" disabled>
          ƒ
        </option>
        {ORACLE_FUNCTIONS.map((fn) => (
          <option key={fn.label} value={fn.label}>
            {fn.label}
          </option>
        ))}
      </select>
    </div>
  );
}
