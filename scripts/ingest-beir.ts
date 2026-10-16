// scripts/ingest-beir.ts
// Usage: npx tsx scripts/ingest-beir.ts scifact
// Loads data/beir/<dataset>/corpus.jsonl into Supabase (documents + chunks, no embeddings yet).
// Safe to re-run: it upserts, so nothing gets duplicated.

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const dataset = process.argv[2] ?? "scifact";
const file = path.join("data", "beir", dataset, "corpus.jsonl");
const BATCH = 200;

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

type Doc = { _id: string; title?: string; text?: string };

async function flush(batch: Doc[]) {
  const { data, error } = await supabase
    .from("documents")
    .upsert(
      batch.map((d) => ({ dataset, external_id: d._id, title: d.title || "(untitled)" })),
      { onConflict: "dataset,external_id" }
    )
    .select("id, external_id");
  if (error) throw error;

  const idMap = new Map<string, number>(data!.map((r) => [r.external_id as string, r.id as number]));

  const chunks = batch.map((d) => ({
    document_id: idMap.get(d._id)!,
    chunk_index: 0, // BEIR abstracts are short, so one chunk per document
    content: `${d.title ?? ""}\n${d.text ?? ""}`.trim(),
  }));

  const { error: cErr } = await supabase
    .from("chunks")
    .upsert(chunks, { onConflict: "document_id,chunk_index" });
  if (cErr) throw cErr;
}

async function main() {
  if (!fs.existsSync(file)) {
    console.error(`Not found: ${file}`);
    process.exit(1);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(file, "utf8"), crlfDelay: Infinity });

  let batch: Doc[] = [];
  let total = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    batch.push(JSON.parse(line));
    if (batch.length >= BATCH) {
      await flush(batch);
      total += batch.length;
      batch = [];
      console.log(`inserted ${total}`);
    }
  }
  if (batch.length) {
    await flush(batch);
    total += batch.length;
  }
  console.log(`done: ${total} documents from ${dataset}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
