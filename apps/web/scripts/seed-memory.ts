/**
 * Seed de memoria del agente (D12). Carga .env.local y guarda memorias iniciales
 * en agent_memory con embeddings OpenAI.
 *
 * Uso:
 *   npm run seed:memory          — inserta solo las que no existen
 *   npm run seed:memory -- --force  — inserta todas (puede duplicar)
 *   npm run seed:memory -- --dry-run — muestra qué se insertaría
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { SEED_MEMORIES } from "../lib/ai/seed-memories";

config({ path: resolve(process.cwd(), ".env.local") });

const EMBEDDING_MODEL = "text-embedding-3-small";

const args = process.argv.slice(2);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o claves de Supabase en .env.local");
    process.exit(1);
  }
  if (!openaiKey || openaiKey === "sk-...") {
    console.error("Falta OPENAI_API_KEY real en .env.local (no puede ser sk-...)");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const supabase = createClient(supabaseUrl, supabaseKey);

  let existingContents = new Set<string>();
  if (!force) {
    const { data, error } = await supabase.from("agent_memory").select("content");
    if (error) {
      console.error("No se pudo leer agent_memory:", error.message);
      console.error("¿Ejecutaste setup-completo.sql en Supabase?");
      process.exit(1);
    }
    existingContents = new Set((data ?? []).map((r) => r.content.trim()));
  }

  let inserted = 0;
  let skipped = 0;

  for (const content of SEED_MEMORIES) {
    const trimmed = content.trim();
    if (!force && existingContents.has(trimmed)) {
      console.log("Omitida (ya existe):", trimmed.slice(0, 60) + "...");
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log("[dry-run] Insertaría:", trimmed.slice(0, 80) + "...");
      inserted++;
      continue;
    }

    const { data: embData } = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: trimmed,
    });
    const embedding = embData[0].embedding;

    const { data: row, error } = await supabase
      .from("agent_memory")
      .insert({ content: trimmed, embedding })
      .select("id")
      .single();

    if (error) {
      console.error("Error guardando:", trimmed.slice(0, 50) + "...", error.message);
      continue;
    }
    console.log("Memoria guardada:", row?.id, trimmed.slice(0, 60) + "...");
    inserted++;
  }

  console.log(
    `\nSeed terminado. Insertadas: ${inserted}, omitidas: ${skipped}${dryRun ? " (dry-run)" : ""}.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
