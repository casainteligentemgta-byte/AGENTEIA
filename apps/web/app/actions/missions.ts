"use server";

import { z } from "zod";
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

const updateMissionStatusSchema = z.object({
  id: z.string().uuid("id debe ser un UUID válido"),
  status: z.enum(["pending", "completed"], {
    errorMap: () => ({ message: "status debe ser 'pending' o 'completed'" }),
  }),
});

export async function getMissions(): Promise<{ missions: Mission[]; error?: string }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { missions: [] };
    }

    const { data, error } = await supabase
      .from("agent_missions")
      .select("id, user_id, title, description, reward_xp, status, due_date, created_at")
      .eq("user_id", user.id)
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
  const parsed = updateMissionStatusSchema.safeParse({ id, status });
  if (!parsed.success) {
    const msg = parsed.error.errors.map((e) => e.message).join("; ");
    return { ok: false, error: msg };
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Debes iniciar sesión para actualizar misiones." };
    }

    const { error } = await supabase
      .from("agent_missions")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.id)
      .eq("user_id", user.id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al actualizar" };
  }
}
