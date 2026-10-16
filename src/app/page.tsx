"use client";
import { useState } from "react";

type Mode = "keyword" | "vector" | "hybrid";
type View = Mode | "compare";
type Hit = { chunk_id: number; document_id: number; title: string; content: string; score: number };
type Result = { mode: Mode; ms?: number; hits?: Hit[]; error?: string };

const ALL: Mode[] = ["keyword", "vector", "hybrid"];
const LABEL: Record<View, string> = {
  keyword: "Keyword (BM25)",
  vector: "Vector",
  hybrid: "Hybrid (RRF)",
  compare: "Compare all",
};
const EXAMPLES = [
  "Metformin reduces the risk of cancer.",
  "Vitamin D supplementation lowers the risk of respiratory infection.",
  "Statins increase the risk of diabetes.",
];

async function search(query: string, mode: Mode): Promise<Result> {
  try {
    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, mode, k: 5 }),
    });
    const data = await res.json();
    if (!res.ok) return { mode, error: data.error ?? "Request failed" };
    return data;
  } catch {
    return { mode, error: "Network error" };
  }
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("hybrid");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  async function run(q = query) {
    if (!q.trim()) return;
    setQuery(q);
    setLoading(true);
    const modes = view === "compare" ? ALL : [view];
    setResults(await Promise.all(modes.map((m) => search(q, m))));
    setLoading(false);
  }

  return (
    <main>
      <style>{css}</style>
      <h1>SciFact Evidence Search</h1>
      <p className="sub">Search scientific abstracts with keyword, vector or hybrid retrieval.</p>

      <div className="bar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder="Enter a scientific claim..."
          maxLength={500}
        />
        <button onClick={() => run()} disabled={loading || !query.trim()}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      <div className="tabs">
        {(Object.keys(LABEL) as View[]).map((v) => (
          <button key={v} className={v === view ? "tab on" : "tab"} onClick={() => setView(v)}>
            {LABEL[v]}
          </button>
        ))}
      </div>

      {results.length === 0 && (
        <div className="examples">
          Try:{" "}
          {EXAMPLES.map((e) => (
            <button key={e} className="chip" onClick={() => run(e)}>
              {e}
            </button>
          ))}
        </div>
      )}

      <div className={results.length > 1 ? "cols" : ""}>
        {results.map((r) => (
          <section key={r.mode}>
            <h2>
              {LABEL[r.mode]} {r.ms !== undefined && <span className="ms">{r.ms} ms</span>}
            </h2>
            {r.error && <p className="err">{r.error}</p>}
            {r.hits?.length === 0 && <p className="sub">No results.</p>}
            {r.hits?.map((h, i) => (
              <article key={h.chunk_id} className="card">
                <div className="meta">
                  #{i + 1} · score {h.score.toFixed(4)}
                </div>
                <h3>{h.title}</h3>
                <details>
                  <summary>{h.content.slice(0, 160)}...</summary>
                  <p>{h.content}</p>
                </details>
              </article>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}

const css = `
:root{--bg:#fff;--fg:#1a1a1a;--mut:#666;--card:#f6f6f7;--bd:#e2e2e5;--ac:#2f5bea}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--fg:#ececee;--mut:#9a9aa2;--card:#1c1c20;--bd:#2c2c32;--ac:#7b9bff}}
body{background:var(--bg);color:var(--fg);margin:0;font-family:system-ui,sans-serif}
main{max-width:1100px;margin:0 auto;padding:40px 20px}
h1{margin:0 0 4px}h2{font-size:16px;margin:20px 0 8px}h3{font-size:15px;margin:6px 0}
.sub{color:var(--mut);margin:0 0 20px}
.bar{display:flex;gap:8px}
input{flex:1;padding:12px;font-size:16px;border:1px solid var(--bd);border-radius:8px;background:var(--card);color:var(--fg)}
button{cursor:pointer;font:inherit}
.bar button{padding:0 20px;border:0;border-radius:8px;background:var(--ac);color:#fff}
.bar button:disabled{opacity:.5;cursor:default}
.tabs{display:flex;gap:6px;margin:14px 0;flex-wrap:wrap}
.tab,.chip{border:1px solid var(--bd);background:transparent;color:var(--fg);padding:6px 12px;border-radius:999px}
.tab.on{background:var(--ac);color:#fff;border-color:var(--ac)}
.examples{color:var(--mut);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px;margin-bottom:10px}
.meta,.ms{color:var(--mut);font-size:12px;font-weight:400}
summary{cursor:pointer;color:var(--mut);font-size:14px}
details p{font-size:14px;line-height:1.5}
.err{color:#d33}
`;
