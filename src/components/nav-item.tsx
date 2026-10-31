import { cn } from "@/lib/utils";

type Props = React.ComponentProps<"button"> & {
  // Item atual: mantém o fio inteiro, sem reagir ao hover nem ao foco.
  current?: boolean;
};

// Item de navegação com um fio de sublinhado desenhado só com `transform`: cresce a partir do início inline
// no hover e no foco e recolhe em direção ao fim ao sair. A origem fica no fim em repouso e passa para o
// início enquanto o item está ativo; só a escala é animada, então a troca de origem é instantânea.
export function NavItem({ current = false, className, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      data-current={current ? "" : undefined}
      aria-current={current ? "true" : undefined}
      className={cn(
        "relative inline-flex items-center py-1 text-sm text-muted-foreground outline-none transition-colors",
        "hover:text-foreground focus-visible:text-foreground data-current:text-foreground",
        "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-current after:content-['']",
        "after:origin-right after:scale-x-0 after:transition-transform after:duration-300 after:ease-out",
        "hover:after:origin-left hover:after:scale-x-100 focus-visible:after:origin-left focus-visible:after:scale-x-100",
        "rtl:after:origin-left rtl:hover:after:origin-right rtl:focus-visible:after:origin-right",
        "data-current:after:scale-x-100 motion-reduce:after:transition-none",
        className,
      )}
      {...props}
    />
  );
}
