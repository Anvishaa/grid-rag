import { tokenize } from "./tokenize";

export interface BM25Index {
  k1: number;
  b: number;
  N: number;
  avgdl: number;
  docIds: string[];
  docLens: number[];
  // term -> list of [docIdx, termFrequency]
  postings: Map<string, [number, number][]>;
}

export interface Scored {
  id: string;
  score: number;
}

export function buildIndex(
  docs: { id: string; text: string }[],
  k1 = 1.2,
  b = 0.75
): BM25Index {
  const postings = new Map<string, [number, number][]>();
  const docIds: string[] = [];
  const docLens: number[] = [];

  docs.forEach((doc, idx) => {
    const tokens = tokenize(doc.text);
    docIds.push(doc.id);
    docLens.push(tokens.length);

    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [term, f] of tf) {
      let list = postings.get(term);
      if (!list) postings.set(term, (list = []));
      list.push([idx, f]);
    }
  });

  const avgdl = docLens.reduce((a, c) => a + c, 0) / docs.length;
  return { k1, b, N: docs.length, avgdl, docIds, docLens, postings };
}

export function searchBM25(index: BM25Index, query: string, k = 10): Scored[] {
  const { k1, b, N, avgdl, docLens, docIds, postings } = index;
  const scores = new Map<number, number>();

  for (const term of new Set(tokenize(query))) {
    const list = postings.get(term);
    if (!list) continue;
    const df = list.length;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (const [d, f] of list) {
      const norm = f + k1 * (1 - b + (b * docLens[d]) / avgdl);
      const s = idf * ((f * (k1 + 1)) / norm);
      scores.set(d, (scores.get(d) ?? 0) + s);
    }
  }

  return [...scores]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([d, score]) => ({ id: docIds[d], score }));
}

export function serializeIndex(index: BM25Index): string {
  return JSON.stringify({ ...index, postings: Object.fromEntries(index.postings) });
}

export function deserializeIndex(json: string): BM25Index {
  const raw = JSON.parse(json);
  return { ...raw, postings: new Map(Object.entries(raw.postings)) };
}
