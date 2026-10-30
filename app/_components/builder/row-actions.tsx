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
      <button
        type="button"
        className="btn-ghost"
        aria-label="Mover para cima"
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="btn-ghost"
        aria-label="Mover para baixo"
        disabled={index === count - 1}
        onClick={() => onMove(index + 1)}
      >
        ↓
      </button>
      {onToggleOff && (
        <button
          type="button"
          className={`btn-ghost ${off ? "text-amber-300" : ""}`}
          aria-label={off ? "Incluir no SQL" : "Omitir do SQL"}
          aria-pressed={off ?? false}
          title={off ? "Omitida do SQL: clique para incluir" : "Omitir do SQL sem remover"}
          onClick={onToggleOff}
        >
          {off ? "⊘" : "◉"}
        </button>
      )}
      <button type="button" className="btn-ghost" aria-label="Remover" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
