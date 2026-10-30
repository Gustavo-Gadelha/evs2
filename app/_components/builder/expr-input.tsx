"use client";

import { useRef } from "react";

import { ORACLE_FUNCTIONS, applyTemplate } from "@/lib/sql/functions";
import { COLUMNS_LIST } from "./dictionary";

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
      <input
        ref={ref}
        aria-label={label}
        spellCheck={false}
        list={COLUMNS_LIST}
        className="input min-w-0 flex-1 rounded-r-none font-mono"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <select
        aria-label={`Inserir função Oracle em ${label}`}
        title="Inserir função Oracle"
        className="input w-9 shrink-0 rounded-l-none border-l-0 px-1 text-center"
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
