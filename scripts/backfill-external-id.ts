import { readFileSync } from "node:fs";
import path from "node:path";
import { supabase } from "../src/lib/clients";

const dataset = process.argv[2] ?? "scifact";
const file = path.join("data", "beir", dataset, "corpus.jsonl");

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

async function main() {
  // Build lookups from the corpus: normalized text -> _id, normalized title+text -> _id
  const byText = new Map<string, string>();
  const byTitleText = new Map<string, string>();
  let dupes = 0;
  const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
  for (const line of lines) {
    const d = JSON.parse(line) as { _id: string; title?: string; text?: string };
    const t = norm(d.text);
    if (byText.has(t)) dupes++;
    byText.set(t, d._id);
    byTitleText.set(norm(`${d.title ?? ""}. ${d.text ?? ""}`), d._id);
    byTitleText.set(norm(`${d.title ?? ""} ${d.text ?? ""}`), d._id);
  }
  console.log(`Corpus lines: ${lines.length} (duplicate texts: ${dupes})`);

  // Fetch chunks with their document titles
  const rows: { document_id: number; content: string; title: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("chunks")
      .select("document_id, content, documents(title)")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const c of data as any[])
      rows.push({ document_id: c.document_id, content: c.content, title: c.documents?.title ?? "" });
    if (data!.length < 1000) break;
  }

  const matches = new Map<number, string>();
  let unmatched = 0;
  const samples: string[] = [];
  for (const r of rows) {
    const id =
      byText.get(norm(r.content)) ??
      byTitleText.get(norm(r.content)) ??
      byTitleText.get(norm(`${r.title}. ${r.content}`));
    if (id) matches.set(r.document_id, id);
    else {
      unmatched++;
      if (samples.length < 3) samples.push(`doc ${r.document_id}: ${r.title}`);
    }
  }
  console.log(`Matched ${matches.size} documents, unmatched ${unmatched}`);
  if (samples.length) console.log("Unmatched samples:", samples);
  if (matches.size === 0) throw new Error("Nothing matched; not writing. Paste this output.");

  const entries = [...matches];
  for (let i = 0; i < entries.length; i += 20) {
    await Promise.all(
      entries.slice(i, i + 20).map(async ([docId, ext]) => {
        const { error } = await supabase.from("documents").update({ external_id: ext }).eq("id", docId);
        if (error) throw error;
      })
    );
    if ((i / 20) % 25 === 0) console.log(`Updated ${Math.min(i + 20, entries.length)}/${entries.length}`);
  }
  console.log("Done.");
}
main();
