type Props = {
  index: number;
  count: number;
  onMove: (to: number) => void;
  onRemove: () => void;
};

export function RowActions({ index, count, onMove, onRemove }: Props) {
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
      <button type="button" className="btn-ghost" aria-label="Remover" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
