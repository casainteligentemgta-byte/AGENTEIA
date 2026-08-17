"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { recordatorioEstadoSchema } from "@/lib/validations/vehiculo";

export async function updateRecordatorioEstadoAction(input: {
  recordatorioId: string;
  estado: "completado" | "cancelado" | "pendiente";
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = recordatorioEstadoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const supabase = createAdminClient();

  const { data: recordatorio } = await supabase
    .from("recordatorios")
    .select("id, vehiculo_id, vehiculos(taller_id)")
    .eq("id", parsed.data.recordatorioId)
    .maybeSingle();

  if (!recordatorio) return { ok: false, error: "Recordatorio no encontrado" };

  const vehiculo = Array.isArray(recordatorio.vehiculos)
    ? recordatorio.vehiculos[0]
    : recordatorio.vehiculos;

  if (!vehiculo || vehiculo.taller_id !== taller.id) {
    return { ok: false, error: "No autorizado" };
  }

  const { error } = await supabase
    .from("recordatorios")
    .update({ estado: parsed.data.estado })
    .eq("id", parsed.data.recordatorioId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/recordatorios");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/vehiculos/${recordatorio.vehiculo_id}`);
  return { ok: true };
}
