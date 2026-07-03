/** Búsqueda web vía Serper (preferido) o Tavily. */

export type WebSearchResult = { title: string; url: string; snippet: string };

export type WebSearchResponse = {
  results: WebSearchResult[];
  provider?: "serper" | "tavily";
  error?: string;
};

function isConfiguredKey(value: string | undefined): value is string {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "..." || trimmed.endsWith("...")) return false;
  return true;
}

/** Indica si hay algún proveedor de búsqueda web configurado. */
export function isWebSearchConfigured(): boolean {
  return isConfiguredKey(process.env.SERPER_API_KEY) || isConfiguredKey(process.env.TAVILY_API_KEY);
}

export function getWebSearchProvider(): "serper" | "tavily" | null {
  if (isConfiguredKey(process.env.SERPER_API_KEY)) return "serper";
  if (isConfiguredKey(process.env.TAVILY_API_KEY)) return "tavily";
  return null;
}

/**
 * Búsqueda web. Prioriza Serper (D11); Tavily como alternativa.
 * Devuelve resultados con URL para que el agente cite fuentes.
 */
export async function doWebSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResponse> {
  const serperKey = process.env.SERPER_API_KEY;
  const tavilyKey = process.env.TAVILY_API_KEY;
  const limit = Math.min(maxResults, 10);

  if (isConfiguredKey(serperKey)) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": serperKey },
        body: JSON.stringify({ q: query, num: limit, gl: "es", hl: "es" }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { results: [], provider: "serper", error: `Serper: ${res.status} ${t.slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        organic?: Array<{ title?: string; link?: string; snippet?: string }>;
        knowledgeGraph?: { title?: string; description?: string; website?: string };
      };
      const organic: WebSearchResult[] = (data.organic ?? []).slice(0, limit).map((r) => ({
        title: r.title ?? "",
        url: r.link ?? "",
        snippet: r.snippet ?? "",
      }));
      const kg = data.knowledgeGraph;
      if (kg?.title && organic.length < limit) {
        organic.unshift({
          title: kg.title,
          url: kg.website ?? "",
          snippet: kg.description ?? "",
        });
      }
      return { results: organic.slice(0, limit), provider: "serper" };
    } catch (e) {
      return {
        results: [],
        provider: "serper",
        error: e instanceof Error ? e.message : "Error en Serper",
      };
    }
  }

  if (isConfiguredKey(tavilyKey)) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tavilyKey}` },
        body: JSON.stringify({ query, search_depth: "basic", max_results: limit }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { results: [], provider: "tavily", error: `Tavily: ${res.status} ${t.slice(0, 200)}` };
      }
      const data = (await res.json()) as {
        results?: Array<{ title?: string; url?: string; content?: string }>;
      };
      const results: WebSearchResult[] = (data.results ?? []).slice(0, limit).map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.content ?? "",
      }));
      return { results, provider: "tavily" };
    } catch (e) {
      return {
        results: [],
        provider: "tavily",
        error: e instanceof Error ? e.message : "Error en Tavily",
      };
    }
  }

  return {
    results: [],
    error:
      "Configura SERPER_API_KEY en .env.local (gratis en serper.dev) o TAVILY_API_KEY para activar búsqueda web.",
  };
}

/** Prueba rápida de conectividad (consume 1 crédito Serper/Tavily). */
export async function probeWebSearch(): Promise<WebSearchResponse & { query: string }> {
  const query = "Next.js App Router";
  const result = await doWebSearch(query, 1);
  return { ...result, query };
}
