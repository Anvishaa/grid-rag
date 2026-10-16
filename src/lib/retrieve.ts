import { readFileSync } from "node:fs";
import path from "node:path";
import { supabase, openai, EMBED_MODEL } from "./clients";
import { deserializeIndex, searchBM25, type BM25Index, type Scored } from "./bm25";
import { rrf } from "./rrf";

export type Mode = "keyword" | "vector" | "hybrid";

export interface Hit {
  chunk_id: number;
  document_id: number;
  title: string;
  content: string;
  score: number;
}

let _index: BM25Index | null = null;
function getIndex(): BM25Index {
  if (!_index) {
    const file = path.join(process.cwd(), "data", "bm25-index.json");
    _index = deserializeIndex(readFileSync(file, "utf8"));
  }
  return _index;
}

const _embedCache = new Map<string, number[]>();
export async function embedQuery(q: string): Promise<number[]> {
  const hit = _embedCache.get(q);
  if (hit) return hit;
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input: q });
  _embedCache.set(q, res.data[0].embedding);
  return res.data[0].embedding;
}

/** Ranked chunk ids (as strings). Used directly by evaluation. */
export async function rankIds(query: string, mode: Mode, k = 10, pool = 50): Promise<Scored[]> {
  const keyword = () => searchBM25(getIndex(), query, pool);
  const vector = async (): Promise<Scored[]> => {
    const emb = await embedQuery(query);
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: JSON.stringify(emb),
      match_count: pool,
    });
    if (error) throw error;
    return (data as { id: number; score: number }[]).map((d) => ({
      id: String(d.id),
      score: d.score,
    }));
  };

  if (mode === "keyword") return keyword().slice(0, k);
  if (mode === "vector") return (await vector()).slice(0, k);
  const vec = await vector();
  return rrf([keyword(), vec]).slice(0, k);
}

/** Ranked results with title and content attached (for the API and RAG). */
export async function retrieve(query: string, mode: Mode = "hybrid", k = 5): Promise<Hit[]> {
  const ranked = await rankIds(query, mode, k);
  const { data, error } = await supabase
    .from("chunks")
    .select("id, document_id, content, documents(title)")
    .in("id", ranked.map((r) => Number(r.id)));
  if (error) throw error;
  const byId = new Map((data as any[]).map((c) => [String(c.id), c]));
  return ranked.map((r) => {
    const c = byId.get(r.id);
    return {
      chunk_id: c.id,
      document_id: c.document_id,
      title: c.documents?.title ?? "",
      content: c.content,
      score: r.score,
    };
  });
}
