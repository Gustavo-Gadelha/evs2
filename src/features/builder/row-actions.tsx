import { Button } from "@/components/ui/button";

type Props = {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
  // Omitir do SQL sem remover a linha; sem `onToggleOff`, o botão não aparece.
  off?: boolean;
  onToggleOff?: () => void;
};

export function RowActions({ index, count, onMove, onRemove, off, onToggleOff }: Props) {
  return (
    <div className="flex shrink-0">
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        aria-label="Mover para cima"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        ↑
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        type="button"
        aria-label="Mover para baixo"
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        ↓
      </Button>
      {onToggleOff && (
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          className={off ? "text-amber-300" : undefined}
          aria-label={off ? "Incluir no SQL" : "Omitir do SQL"}
          aria-pressed={off ?? false}
          title={off ? "Omitida do SQL: clique para incluir" : "Omitir do SQL sem remover"}
          onClick={onToggleOff}
        >
          {off ? "⊘" : "◉"}
        </Button>
      )}
      <Button variant="ghost" size="icon-xs" type="button" aria-label="Remover" onClick={onRemove}>
        ✕
      </Button>
    </div>
  );
}
