export type Fused = { id: string; score: number };

// Reciprocal rank fusion: cada ranking (ids do melhor ao pior) soma 1 / (k + posição) por id.
// Só usa a posição, então vetor e busca textual (scores em escalas diferentes) se combinam sem normalização.
export function reciprocalRankFusion(rankings: string[][], k = 60): Fused[] {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    const seen = new Set<string>();
    ranking.forEach((id, index) => {
      if (seen.has(id)) return;
      seen.add(id);
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
