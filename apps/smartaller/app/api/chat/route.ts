import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { buildSmartallerSystemPrompt } from "@/lib/ai/smartaller-prompt";
import {
  getChatModelId,
  getLlmApiKey,
  getOpenAIBaseURL,
  getOpenRouterHeaders,
  isLlmConfigured,
} from "@/lib/ai/openai-config";
import { buildVehicleChatContext } from "@/lib/ai/vehicle-context";
import { checkChatRateLimit } from "@/lib/ai/rate-limit";
import { getUser } from "@/lib/supabase/server";

export const maxDuration = 30;

const chatRequestSchema = z.object({
  messages: z.array(z.custom<UIMessage>()),
  vehiculoId: z.string().uuid("ID de vehículo inválido"),
});

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Debes iniciar sesión." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const rate = checkChatRateLimit(user.id);
    if (!rate.ok) {
      return new Response(
        JSON.stringify({
          error: `Demasiadas solicitudes. Espera ${rate.retryAfterSec}s e intenta de nuevo.`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(rate.retryAfterSec),
          },
        }
      );
    }

    const parsed = chatRequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.errors[0]?.message ?? "Solicitud inválida" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { messages, vehiculoId } = parsed.data;

    const context = await buildVehicleChatContext(vehiculoId);
    if (!context) {
      return new Response(JSON.stringify({ error: "Vehículo no encontrado." }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!isLlmConfigured()) {
      return new Response(
        JSON.stringify({
          error:
            "Falta OPENAI_API_KEY. Configúrala en .env.local (OpenAI sk-proj-... u OpenRouter sk-or-v1-...) o en Vercel.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const openai = createOpenAI({
      apiKey: getLlmApiKey(),
      baseURL: getOpenAIBaseURL(),
      headers: getOpenRouterHeaders(),
    });

    const result = streamText({
      model: openai(getChatModelId()),
      system: buildSmartallerSystemPrompt(context),
      messages: await convertToModelMessages(messages),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result.stream }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error en Chat Smartaller";
    console.error("POST /api/chat:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
