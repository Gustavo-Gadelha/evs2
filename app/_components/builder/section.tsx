import type { Problem } from "@/lib/sql/query-state";

type Props = {
  title: string;
  problems: Problem[];
  children: React.ReactNode;
};

export function Section({ title, problems, children }: Props) {
  return (
    <details open className="rounded border border-zinc-800 bg-zinc-900/40">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2">
        <span className="label">{title}</span>
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
