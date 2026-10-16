import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import OpenAI from "openai";

const key = process.env.OPENAI_API_KEY;
console.log("key present:", !!key, key ? `(${key.slice(0, 7)}...${key.slice(-4)}, len ${key.length})` : "");

new OpenAI({ apiKey: key, maxRetries: 0 }).embeddings
  .create({ model: "text-embedding-3-small", input: "test" })
  .then((r) => console.log("OK, dims:", r.data[0].embedding.length))
  .catch((e) => console.log("FAILED:", e.status, e.code, e.message));