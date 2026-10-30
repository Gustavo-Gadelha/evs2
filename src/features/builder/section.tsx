import type { Problem } from "@/lib/sql/query-state";

type Props = {
  title: string;
  problems: Problem[];
  // Itens omitidos do SQL (`off`) dentro da seção.
  off?: number;
  // Omite a seção inteira do SQL; sem `onToggleOmit`, o checkbox não aparece.
  omitted?: boolean;
  onToggleOmit?: () => void;
  children: React.ReactNode;
};

export function Section({ title, problems, off = 0, omitted = false, onToggleOmit, children }: Props) {
  return (
    <details open className={`rounded border border-zinc-800 bg-zinc-900/40 ${omitted ? "opacity-60" : ""}`}>
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2">
        <span className="label">{title}</span>
        {off > 0 && (
          <span className="rounded bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-300">
            {off} {off === 1 ? "omitido" : "omitidos"}
          </span>
        )}
        {onToggleOmit && (
          <label
            className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400"
            title="Omitir do SQL sem remover o que foi montado"
            onClick={(event) => event.stopPropagation()}
          >
            <input type="checkbox" checked={omitted} onChange={onToggleOmit} />
            omitir
          </label>
        )}
        {problems.length > 0 && (
          <span className="rounded bg-red-500/15 px-1.5 text-[10px] font-semibold text-red-300">
            {problems.length}
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-2 border-t border-zinc-800 p-3">
        {children}
        {problems.map((problem, index) => (
          <p key={index} className="text-xs text-red-400">
            {problem.message}
          </p>
        ))}
      </div>
    </details>
  );
}
