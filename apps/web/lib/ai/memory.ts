import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import {
  getEmbeddingModelId,
  getLlmApiKey,
  getOpenAIBaseURL,
  getOpenRouterHeaders,
} from "@/lib/ai/openai-config";

const openai = new OpenAI({
  apiKey: getLlmApiKey(),
  baseURL: getOpenAIBaseURL(),
  defaultHeaders: getOpenRouterHeaders(),
});

const EMBEDDING_MODEL = getEmbeddingModelId();

/**
 * Genera el embedding de un texto usando OpenAI text-embedding-3-small.
 */
async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

/**
 * Guarda un contenido en la memoria del usuario autenticado.
 * Las memorias de sistema (user_id null) solo se crean con el seed + service role.
 */
export async function saveMemory(content: string): Promise<{ id?: string; error?: Error }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: new Error("Inicia sesión para guardar memoria.") };
  }

  const embedding = await getEmbedding(content);

  const { data, error } = await supabase
    .from("agent_memory")
    .insert({ content, embedding, user_id: user.id })
    .select("id")
    .single();

  if (error) return { error: error as unknown as Error };
  return { id: data?.id };
}

/**
 * Recupera memorias relevantes: sistema (user_id null) + las del usuario actual.
 * RLS + RPC match_agent_memories filtran por auth.uid().
 */
export async function retrieveMemories(
  query: string,
  options?: { limit?: number }
): Promise<{ memories: Array<{ id: string; content: string; similarity?: number }>; error?: Error }> {
  const supabase = createClient();
  const queryEmbedding = await getEmbedding(query);
  const limit = options?.limit ?? 10;

  const { data, error } = await supabase.rpc("match_agent_memories", {
    query_embedding: queryEmbedding,
    match_count: limit,
  });

  if (error) return { memories: [], error: error as unknown as Error };
  return {
    memories: (data ?? []).map((row: { id: string; content: string; similarity?: number }) => ({
      id: row.id,
      content: row.content,
      similarity: row.similarity,
    })),
  };
}
