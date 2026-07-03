/**
 * Prueba Serper/Tavily desde terminal (D11).
 * Uso: npm run test:serper
 *      npm run test:serper -- "tu consulta"
 */
import { config } from "dotenv";
import { resolve } from "path";
import { doWebSearch, getWebSearchProvider, isWebSearchConfigured } from "../lib/ai/web-search";

config({ path: resolve(process.cwd(), ".env.local") });

const query = process.argv.slice(2).join(" ") || "tendencias micro SaaS 2025";

async function main() {
  if (!isWebSearchConfigured()) {
    console.error("Configura SERPER_API_KEY en .env.local (https://serper.dev — plan gratis)");
    process.exit(1);
  }

  console.log(`Proveedor: ${getWebSearchProvider()}`);
  console.log(`Consulta: "${query}"\n`);

  const { results, error, provider } = await doWebSearch(query, 3);

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  if (results.length === 0) {
    console.log("Sin resultados.");
    process.exit(0);
  }

  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.title}`);
    console.log(`   ${r.url}`);
    console.log(`   ${r.snippet.slice(0, 120)}...\n`);
  });

  console.log(`OK — ${results.length} resultado(s) vía ${provider}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
