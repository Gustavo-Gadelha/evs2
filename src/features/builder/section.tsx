import type { Problem } from "@/lib/sql/query-state";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
    <details open className={`rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 ${omitted ? "opacity-60" : ""}`}>
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2">
        <span className="label">{title}</span>
        {off > 0 && (
          <Badge className="h-4 rounded bg-amber-500/15 px-1.5 text-[10px] text-amber-300">
            {off} {off === 1 ? "omitido" : "omitidos"}
          </Badge>
        )}
        {onToggleOmit && (
          <Label
            className="ml-auto cursor-pointer gap-1.5 text-xs font-normal text-muted-foreground"
            title="Omitir do SQL sem remover o que foi montado"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox checked={omitted} onCheckedChange={() => onToggleOmit()} />
            omitir
          </Label>
        )}
        {problems.length > 0 && (
          <Badge variant="destructive" className="h-4 rounded px-1.5 text-[10px]">
            {problems.length}
          </Badge>
        )}
      </summary>
      <div className="flex flex-col gap-2 border-t p-3">
        {children}
        {problems.map((problem, index) => (
          <p key={index} className="text-xs text-destructive">
            {problem.message}
          </p>
        ))}
      </div>
    </details>
  );
}
