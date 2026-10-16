import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { supabase } from "../src/lib/clients";
import { rankIds, type Mode } from "../src/lib/retrieve";

const dataset = process.argv[2] ?? "scifact";
const limit = process.argv[3] ? Number(process.argv[3]) : Infinity;
const dir = path.join("data", "beir", dataset);
const MODES: Mode[] = ["keyword", "vector", "hybrid"];
const K = 10;

function loadQueries(): Map<string, string> {
  const m = new Map<string, string>();
  for (const line of readFileSync(path.join(dir, "queries.jsonl"), "utf8").split("\n").filter(Boolean)) {
    const q = JSON.parse(line);
    m.set(String(q._id), q.text);
  }
  return m;
}

function loadQrels(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const lines = readFileSync(path.join(dir, "qrels", "test.tsv"), "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines.slice(1)) {
    const [qid, did, score] = line.split("\t");
    if (Number(score) > 0) {
      if (!m.has(qid)) m.set(qid, new Set());
      m.get(qid)!.add(did);
    }
  }
  return m;
}

async function chunkToExternal(): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("chunks")
      .select("id, documents(external_id)")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const c of data as any[]) if (c.documents?.external_id) m.set(String(c.id), c.documents.external_id);
    if (data!.length < 1000) break;
  }
  return m;
}

function metrics(ranked: string[], rel: Set<string>) {
  const top5 = ranked.slice(0, 5);
  const recall5 = top5.filter((d) => rel.has(d)).length / rel.size;
  const firstRel = ranked.findIndex((d) => rel.has(d));
  const mrr = firstRel >= 0 ? 1 / (firstRel + 1) : 0;
  let dcg = 0;
  ranked.slice(0, 10).forEach((d, i) => { if (rel.has(d)) dcg += 1 / Math.log2(i + 2); });
  let idcg = 0;
  for (let i = 0; i < Math.min(rel.size, 10); i++) idcg += 1 / Math.log2(i + 2);
  return { recall5, mrr, ndcg: idcg ? dcg / idcg : 0 };
}

async function main() {
  const queries = loadQueries();
  const qrels = loadQrels();
  const c2e = await chunkToExternal();
  console.log(`Chunks with external_id: ${c2e.size}`);
  if (c2e.size === 0) throw new Error("No external_id found. Run backfill-external-id.ts first.");

  const qids = [...qrels.keys()].filter((q) => queries.has(q)).slice(0, limit);
  console.log(`Evaluating ${qids.length} test queries\n`);

  const sums: Record<string, { recall5: number; mrr: number; ndcg: number }> = {};
  for (const m of MODES) sums[m] = { recall5: 0, mrr: 0, ndcg: 0 };

  const CONC = 5;
  for (let i = 0; i < qids.length; i += CONC) {
    await Promise.all(
      qids.slice(i, i + CONC).map(async (qid) => {
        for (const mode of MODES) {
          const ranked = await rankIds(queries.get(qid)!, mode, K);
          const docs: string[] = [];
          for (const r of ranked) {
            const ext = c2e.get(r.id);
            if (ext && !docs.includes(ext)) docs.push(ext);
          }
          const m = metrics(docs, qrels.get(qid)!);
          sums[mode].recall5 += m.recall5;
          sums[mode].mrr += m.mrr;
          sums[mode].ndcg += m.ndcg;
        }
      })
    );
    if ((i / CONC) % 10 === 0) console.log(`  ${Math.min(i + CONC, qids.length)}/${qids.length}`);
  }

  const n = qids.length;
  const results = MODES.map((mode) => ({
    mode,
    "Recall@5": +(sums[mode].recall5 / n).toFixed(4),
    "MRR@10": +(sums[mode].mrr / n).toFixed(4),
    "nDCG@10": +(sums[mode].ndcg / n).toFixed(4),
  }));
  console.log();
  console.table(results);
  writeFileSync(path.join("data", "eval-results.json"), JSON.stringify({ n, results }, null, 2));
  console.log("Saved data/eval-results.json");
}
main();
