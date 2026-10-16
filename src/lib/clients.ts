import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_KEY ??
  process.env.SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    `Missing Supabase env. url: ${url ? "ok" : "MISSING"}, service key: ${key ? "ok" : "MISSING"}. ` +
      `Looked for SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local and .env`
  );
}

export const supabase = createClient(url, key);
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const EMBED_MODEL = "text-embedding-3-small";
