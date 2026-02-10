"use server";

import { createClient } from "@/lib/supabase/server";

/** +10 XP por cada nuevo recuerdo guardado. */
const XP_PER_MEMORY = 10;

/** Subida de nivel cada 100 XP. */
const XP_PER_LEVEL = 100;

export type AgentStatusData = {
  memoryCount: number;
  totalXp: number;
  level: number;
  xpPercent: number; // 0–100, progreso hacia el siguiente nivel
  skills: string[];
  error?: string;
};

export async function getAgentStatus(): Promise<AgentStatusData> {
  const fallback: AgentStatusData = {
    memoryCount: 0,
    totalXp: 0,
    level: 1,
    xpPercent: 0,
    skills: [],
  };

  try {
    const supabase = createClient();

    const [memoriesResult, profileResult] = await Promise.all([
      supabase.from("agent_memory").select("id", { count: "exact", head: true }),
      supabase.from("agent_profile").select("tags").limit(1).maybeSingle(),
    ]);

    const memoryCount = memoriesResult.count ?? 0;
    const rawTags = profileResult.data?.tags;

    let skills: string[] = [];
    if (Array.isArray(rawTags)) {
      skills = rawTags.filter((t): t is string => typeof t === "string");
    } else if (typeof rawTags === "string") {
      try {
        const parsed = JSON.parse(rawTags) as unknown;
        skills = Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
      } catch {
        skills = [rawTags];
      }
    }

    const totalXp = memoryCount * XP_PER_MEMORY;
    const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
    const xpPercent = totalXp > 0 ? (totalXp % XP_PER_LEVEL) : 0;

    return {
      memoryCount,
      totalXp,
      level,
      xpPercent,
      skills,
      error: memoriesResult.error?.message ?? profileResult.error?.message,
    };
  } catch (e) {
    return {
      ...fallback,
      error: e instanceof Error ? e.message : "Error al cargar estado",
    };
  }
}
