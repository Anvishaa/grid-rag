import { mkdirSync, writeFileSync } from "node:fs";
import { supabase } from "../src/lib/clients";
import { buildIndex, serializeIndex } from "../src/lib/bm25";

async function fetchAll() {
  const rows: { id: number; document_id: number; content: string | null; title: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("chunks")
      .select("id, document_id, content, documents(title)")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const c of data as any[]) {
      rows.push({
        id: c.id,
        document_id: c.document_id,
        content: c.content,
        title: c.documents?.title ?? "",
      });
    }
    if (data!.length < 1000) break;
  }
  return rows;
}

async function main() {
  const rows = await fetchAll();
  const empty = rows.filter((r) => !r.content).length;
  console.log(`Fetched ${rows.length} chunks (${empty} with empty content)`);

  // Index id = chunks.id. Map to documents/BEIR ids later in retrieval.
  const index = buildIndex(
    rows.map((r) => ({ id: String(r.id), text: `${r.title}. ${r.content ?? ""}` }))
  );
  mkdirSync("data", { recursive: true });
  writeFileSync("data/bm25-index.json", serializeIndex(index));
  console.log(`Indexed ${index.postings.size} terms, avgdl=${index.avgdl.toFixed(1)}`);
}
main();
