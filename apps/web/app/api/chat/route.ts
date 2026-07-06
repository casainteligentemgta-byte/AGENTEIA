import { createOpenAI } from "@ai-sdk/openai";
import {
  getChatModelId,
  getLlmApiKey,
  getOpenAIBaseURL,
  getOpenRouterHeaders,
  isLlmConfigured,
} from "@/lib/ai/openai-config";
import { getMessageText } from "@/lib/ai/chat-messages";
import {
  streamText,
  tool,
  type UIMessage,
  convertToCoreMessages,
  zodSchema,
} from "ai";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { retrieveMemories, saveMemory } from "@/lib/ai/memory";
import { buildMemoryContext, buildSystemPrompt } from "@/lib/ai/system-prompt";
import { getLastUserMessageText } from "@/lib/ai/chat-messages";
import { doWebSearch } from "@/lib/ai/web-search";
import { createClient } from "@/lib/supabase/server";

/** Raíz del proyecto web: apps/web (o cwd si ya estamos ahí). */
function getWebRoot(): string {
  const candidate = path.join(process.cwd(), "apps", "web");
  if (fsSync.existsSync(candidate)) return candidate;
  return process.cwd();
}

const WEB_ROOT = getWebRoot();

/** Asegura que targetPath está dentro de basePath (evita path traversal). */
function isInside(basePath: string, targetPath: string): boolean {
  const base = path.resolve(basePath);
  const target = path.resolve(basePath, targetPath);
  return target === base || target.startsWith(base + path.sep);
}

/** Construye el árbol de archivos de un directorio (maxDepth, ignora node_modules/.next). */
function buildFileTree(dirPath: string, prefix: string, maxDepth: number, depth: number): string[] {
  if (depth > maxDepth) return [];
  const entries = fsSync.readdirSync(dirPath, { withFileTypes: true });
  const lines: string[] = [];
  const skip = new Set(["node_modules", ".next", ".git", ".turbo"]);
  const sorted = entries.filter((e) => !skip.has(e.name)).sort((a, b) => (a.name < b.name ? -1 : 1));
  sorted.forEach((entry, i) => {
    const isLast = i === sorted.length - 1;
    const branch = isLast ? "└── " : "├── ";
    const nextPrefix = isLast ? "    " : "│   ";
    lines.push(prefix + branch + entry.name);
    if (entry.isDirectory()) {
      lines.push(
        ...buildFileTree(path.join(dirPath, entry.name), prefix + nextPrefix, maxDepth, depth + 1)
      );
    }
  });
  return lines;
}

const agentTools = {
  webSearch: tool({
    description:
      "Busca información actual en internet. Úsala cuando el usuario pregunte por noticias, documentación actualizada, análisis de competidores, tendencias recientes o datos que requieran información en tiempo real. Siempre cita las fuentes (incluye los enlaces URL) en tu respuesta.",
    parameters: zodSchema(
      z.object({
        query: z.string().describe("Consulta de búsqueda en lenguaje natural, en español o inglés"),
        max_results: z.number().min(1).max(10).optional().default(5),
      })
    ),
    execute: async ({ query, max_results }) => doWebSearch(query, max_results),
  }),
  createFile: tool({
    description:
      "Crea o sobrescribe un archivo en el proyecto (apps/web). path es relativo a apps/web, p. ej. 'components/foo.tsx'. content es el contenido completo del archivo.",
    parameters: zodSchema(
      z.object({
        path: z.string().describe("Ruta relativa del archivo dentro de apps/web, p. ej. app/page.tsx"),
        content: z.string().describe("Contenido completo del archivo"),
      })
    ),
    execute: async ({ path: filePath, content }) => {
      if (!isInside(WEB_ROOT, filePath)) {
        return { ok: false, error: "La ruta no está permitida (debe estar dentro del proyecto)." };
      }
      const fullPath = path.join(WEB_ROOT, filePath);
      try {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, content, "utf-8");
        return { ok: true, path: filePath };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Error al escribir el archivo." };
      }
    },
  }),
  readProjectStructure: tool({
    description:
      "Devuelve el árbol de archivos y carpetas de apps/web (sin node_modules ni .next). Útil para ver la estructura del proyecto antes de crear o editar archivos.",
    parameters: zodSchema(z.object({})),
    execute: async () => {
      try {
        const lines = [path.basename(WEB_ROOT) || "apps/web", ...buildFileTree(WEB_ROOT, "", 6, 0)];
        return { ok: true, tree: lines.join("\n") };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Error al leer la estructura." };
      }
    },
  }),
  listMissions: tool({
    description:
      "Lista las misiones del usuario: pendientes y completadas. Úsala para saber qué tareas tiene pendientes antes de proponer nuevas o para responder preguntas sobre su carga de trabajo. Devuelve títulos, fechas límite y estado.",
    parameters: zodSchema(z.object({})),
    execute: async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return {
            ok: false,
            error: "Inicia sesión para ver tus misiones.",
            pending_count: 0,
            completed_count: 0,
          };
        }
        const { data, error } = await supabase
          .from("agent_missions")
          .select("id, title, description, status, due_date, reward_xp")
          .eq("user_id", user.id)
          .order("due_date", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });
        if (error) return { ok: false, error: error.message };
        const list = (data ?? []) as {
          id: string;
          title: string;
          description: string | null;
          status: string;
          due_date: string | null;
          reward_xp: number;
        }[];
        const pending = list.filter((m) => m.status === "pending");
        const completed = list.filter((m) => m.status === "completed");
        return {
          ok: true,
          pending_count: pending.length,
          completed_count: completed.length,
          pending: pending.map((m) => ({
            title: m.title,
            description: m.description,
            due_date: m.due_date,
            reward_xp: m.reward_xp,
          })),
          completed: completed.map((m) => ({ title: m.title, due_date: m.due_date })),
        };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Error al listar misiones." };
      }
    },
  }),
  assignMission: tool({
    description:
      "Asigna una nueva misión al usuario en Mission Control. Úsala cuando propongas una misión concreta basada en los objetivos de negocio (ej. lanzar micro-SaaS, mejorar producto). La misión aparecerá en el tablero de misiones.",
    parameters: zodSchema(
      z.object({
        title: z.string().describe("Título corto de la misión"),
        description: z.string().optional().describe("Descripción opcional de pasos o criterios"),
        reward_xp: z.number().min(5).max(100).optional().default(10),
        due_date: z
          .string()
          .optional()
          .describe("Fecha límite en formato YYYY-MM-DD, ej. 2025-02-15"),
      })
    ),
    execute: async ({ title, description, reward_xp, due_date }) => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return { ok: false, error: "Inicia sesión para asignar misiones." };
        }
        const { data, error } = await supabase
          .from("agent_missions")
          .insert({
            user_id: user.id,
            title,
            description: description ?? null,
            reward_xp: reward_xp ?? 10,
            status: "pending",
            due_date: due_date ?? null,
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };
        return { ok: true, id: data?.id, title };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Error al asignar misión." };
      }
    },
  }),
};

const openai = createOpenAI({
  apiKey: getLlmApiKey(),
  baseURL: getOpenAIBaseURL(),
  headers: getOpenRouterHeaders(),
});

/** Normaliza UIMessage (content o parts) para convertToCoreMessages. */
function normalizeForCore(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => {
    if (m.parts && m.parts.length > 0) return m;
    const text = getMessageText(m as Parameters<typeof getMessageText>[0]);
    return { ...m, parts: [{ type: "text" as const, text }] };
  });
}

/**
 * Detecta si el mensaje del usuario contiene información valiosa para recordar:
 * información personal, objetivos o preferencias técnicas. Todo en segundo plano (no bloquea).
 */
function shouldSaveAsMemory(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 20) return false;

  const greetings = ["hola", "hi ", "hey", "buenos", "buenas", "ok", "vale", "gracias", "thanks", "adiós"];
  if (greetings.some((g) => t.startsWith(g) && t.length < 50)) return false;

  // Información personal: nombre, trabajo, ciudad, aficiones, situación
  const personal =
    /\b(me llamo|mi nombre|soy [a-záéíóú]|trabajo en|vivo en|soy de|tengo \d+|mi (empresa|empresa es)|(me )?dedico a)\b/.test(t) ||
    /\b(mi (hijo|hija|mujer|marido|pareja)|estoy (casado|soltero)|afición|hobby)\b/.test(t);

  // Objetivos: metas, planes, lo que quiere lograr
  const goals =
    /\b(mi (objetivo|meta|objetivos|meta es)|quiero (lanzar|crear|hacer|conseguir)|voy a (lanzar|crear)|planeo|mi plan|a futuro|este (año|trimestre|mes))\b/.test(t) ||
    /\b(objetivo:|meta:|pretendo|aspiro a)\b/.test(t);

  // Preferencias técnicas: stack, herramientas, lenguajes, frameworks
  const technical =
    /\b(stack|tecnología|tecnologías|framework|framework preferido|uso (react|vue|next|node)|prefiero .*(en |para )|lenguaje favorito|herramienta|antigravity|micro-saas|saas)\b/.test(t) ||
    /\b(recuerda que|guarda que|importante:?|preferencia:?|siempre .*(uso|prefiero)|nunca .*(uso|prefiero))\b/.test(t);

  return personal || goals || technical || t.length > 100;
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    const lastUserText = getLastUserMessageText(messages);

    // Al inicio de cada turno: recuperar los 5 recuerdos más relevantes (RPC match_agent_memories)
    // y añadirlos al system prompt para que el agente demuestre que conoce al usuario.
    let memoryContext = "";
    try {
      const queryForMemories = lastUserText.trim() || "preferencias objetivos del usuario";
      const { memories } = await retrieveMemories(queryForMemories, { limit: 5 });
      if (memories.length > 0) {
        memoryContext = buildMemoryContext(memories.map((m) => m.content));
      }
    } catch {
      // Sin Supabase o sin RPC, seguimos sin contexto; no bloqueamos la respuesta
    }

    const systemPrompt = buildSystemPrompt(memoryContext || undefined);

    // Aprendizaje asíncrono: si el usuario aporta información personal, objetivos o preferencias
    // técnicas, guardarla en agent_memory (con embedding). No bloquea la respuesta del chat.
    if (lastUserText && shouldSaveAsMemory(lastUserText)) {
      saveMemory(lastUserText).catch(() => {});
    }

    if (!isLlmConfigured()) {
      return new Response(
        JSON.stringify({
          error:
            "Falta OPENAI_API_KEY. Añádela en .env.local (OpenAI sk-proj-... u OpenRouter sk-or-v1-...) o en Vercel y redeploy.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = streamText({
      model: openai(getChatModelId()),
      system: systemPrompt,
      messages: convertToCoreMessages(normalizeForCore(messages)),
      tools: agentTools,
      maxSteps: 5,
    });

    return result.toDataStreamResponse({
      getErrorMessage: (error) =>
        error instanceof Error ? error.message : "Error al generar respuesta del agente",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error en el chat";
    console.error("[api/chat]", message, err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
