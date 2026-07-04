"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { updateVehiculoContactoSchema } from "@/lib/validations/vehiculo";

export async function updateVehiculoContactoAction(input: {
  vehiculoId: string;
  nombreCliente: string;
  telefonoCliente: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const parsed = updateVehiculoContactoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const supabase = createAdminClient();
  const { data: vehiculo } = await supabase
    .from("vehiculos")
    .select("id, taller_id")
    .eq("id", parsed.data.vehiculoId)
    .maybeSingle();

  if (!vehiculo || vehiculo.taller_id !== taller.id) {
    return { ok: false, error: "Vehículo no encontrado" };
  }

  const { error } = await supabase
    .from("vehiculos")
    .update({
      nombre_cliente: parsed.data.nombreCliente,
      telefono_cliente: parsed.data.telefonoCliente,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.vehiculoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/vehiculos");
  revalidatePath(`/dashboard/vehiculos/${parsed.data.vehiculoId}`);
  return { ok: true };
}
