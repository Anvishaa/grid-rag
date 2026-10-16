import type { Scored } from "./bm25";

/** Reciprocal Rank Fusion: score(d) = sum over lists of 1 / (k + rank), rank starting at 1. */
export function rrf(lists: Scored[][], k = 60): Scored[] {
  const fused = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, i) => {
      fused.set(item.id, (fused.get(item.id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return [...fused]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
