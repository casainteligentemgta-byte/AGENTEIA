import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { getEmbeddingModelId, getLlmApiKey, getOpenAIBaseURL } from "@/lib/ai/openai-config";

const openai = new OpenAI({
  apiKey: getLlmApiKey(),
  baseURL: getOpenAIBaseURL(),
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
 * Guarda un contenido en la memoria del agente: genera su embedding con OpenAI
 * y lo persiste en la tabla agent_memory de Supabase.
 */
export async function saveMemory(content: string): Promise<{ id?: string; error?: Error }> {
  const supabase = createClient();
  const embedding = await getEmbedding(content);

  const { data, error } = await supabase
    .from("agent_memory")
    .insert({ content, embedding })
    .select("id")
    .single();

  if (error) return { error: error as unknown as Error };
  return { id: data?.id };
}

/**
 * Recupera memorias relevantes para un query: convierte el query en embedding
 * y llama a la función RPC match_agent_memories de Supabase.
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
