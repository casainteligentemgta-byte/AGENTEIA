"use server";

import { createClient } from "@/lib/supabase/server";

export type Mission = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  reward_xp: number;
  status: "pending" | "completed";
  due_date: string | null;
  created_at: string;
};

export async function getMissions(): Promise<{ missions: Mission[]; error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("agent_missions")
      .select("id, user_id, title, description, reward_xp, status, due_date, created_at")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) return { missions: [], error: error.message };
    return { missions: (data ?? []) as Mission[] };
  } catch (e) {
    return {
      missions: [],
      error: e instanceof Error ? e.message : "Error al cargar misiones",
    };
  }
}

export async function updateMissionStatus(
  id: string,
  status: "pending" | "completed"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("agent_missions").update({ status }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar" };
  }
}
