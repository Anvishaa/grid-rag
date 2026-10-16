// scripts/embed.ts
// Usage: npx tsx scripts/embed.ts        (embed everything that has no vector yet)
//        npx tsx scripts/embed.ts 100    (embed only 100 rows, good for a first test)
// Safe to re-run: it only touches chunks where embedding is still null.

import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: [".env.local", ".env" ] });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BATCH = 100; // lower to 50 if Supabase times out on writes
const MODEL = "text-embedding-3-small"; // 1536 dims, matches the schema
const max = process.argv[2] ? Number(process.argv[2]) : Infinity;

async function embedWithRetry(inputs: string[]): Promise<number[][]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await openai.embeddings.create({ model: MODEL, input: inputs });
      return res.data.map((d) => d.embedding);
    } catch (err: any) {
      const wait = 1000 * 2 ** attempt;
      console.warn(`embedding call failed (${err?.status ?? err?.message}), retrying in ${wait} ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("embedding failed after 6 attempts");
}

async function main() {
  let done = 0;
  while (done < max) {
    const take = Math.min(BATCH, max - done);
    const { data, error } = await supabase
      .from("chunks")
      .select("id, document_id, content")
      .is("embedding", null)
      .order("id")
      .limit(take);
    if (error) throw error;
    if (!data || data.length === 0) break;

    const vectors = await embedWithRetry(data.map((r) => r.content as string));

    // upsert needs the not-null columns too, so we pass them back unchanged
    const rows = data.map((r, i) => ({
      id: r.id,
      document_id: r.document_id,
      content: r.content,
      embedding: vectors[i],
    }));
    const { error: upErr } = await supabase.from("chunks").upsert(rows, { onConflict: "id" });
    if (upErr) throw upErr;

    done += data.length;
    console.log(`embedded ${done}`);
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
