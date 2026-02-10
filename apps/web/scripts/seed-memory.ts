/**
 * Seed de memoria del agente. Carga .env.local y guarda las memorias iniciales
 * en la tabla agent_memory (embedding vía OpenAI).
 *
 * Uso: pnpm run seed:memory
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

config({ path: resolve(process.cwd(), ".env.local") });

const EMBEDDING_MODEL = "text-embedding-3-small";

const SEED_MEMORIES = [
  "Recuerda que mi stack favorito es Antigravity y mi objetivo es lanzar 3 micro-SaaS este trimestre.",
];

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o claves de Supabase en .env.local");
    process.exit(1);
  }
  if (!openaiKey) {
    console.error("Falta OPENAI_API_KEY en .env.local");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const supabase = createClient(supabaseUrl, supabaseKey);

  for (const content of SEED_MEMORIES) {
    const { data } = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: content,
    });
    const embedding = data[0].embedding;

    const { data: row, error } = await supabase
      .from("agent_memory")
      .insert({ content, embedding })
      .select("id")
      .single();

    if (error) {
      console.error("Error guardando memoria:", content.slice(0, 50) + "...", error.message);
      continue;
    }
    console.log("Memoria guardada:", row?.id, content.slice(0, 60) + "...");
  }

  console.log("Seed de memoria terminado.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
