"use client";

import { useEffect, useRef, useState } from "react";

import { OMITTABLE_SECTIONS, type OmittableSection } from "@/lib/sql/query-state";

type Props = {
  omit: OmittableSection[];
  onChange: (omit: OmittableSection[]) => void;
};

export function OmitMenu({ omit, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(section: OmittableSection) {
    onChange(omit.includes(section) ? omit.filter((item) => item !== section) : [...omit, section]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn flex items-center gap-2"
        aria-expanded={open}
        title="Omitir partes do SQL gerado sem remover o que foi montado"
        onClick={() => setOpen(!open)}
      >
        Omitir
        {omit.length > 0 && (
          <span className="rounded bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-300">{omit.length}</span>
        )}
      </button>
      {open && (
        <div className="panel absolute right-0 top-full z-20 mt-1 flex w-56 flex-col gap-2 !bg-zinc-900 shadow-lg">
          <p className="label">Omitir do SQL</p>
          {OMITTABLE_SECTIONS.map(({ section, label }) => (
            <label key={section} className="flex cursor-pointer items-center gap-2 text-xs text-zinc-200">
              <input type="checkbox" checked={omit.includes(section)} onChange={() => toggle(section)} />
              {label}
            </label>
          ))}
          <button type="button" className="btn-ghost self-start" disabled={omit.length === 0} onClick={() => onChange([])}>
            Limpar omissões
          </button>
        </div>
      )}
    </div>
  );
}
