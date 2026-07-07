"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { maintenanceProtocolSchema } from "@/lib/validations/smartbike";

export type SmartBikeActionResult =
  | { success: true; protocolId: string }
  | { success: false; error: string };

export async function submitMaintenanceProtocol(
  raw: unknown
): Promise<SmartBikeActionResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "Debes iniciar sesión" };
  }

  const parsed = maintenanceProtocolSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Datos inválidos",
    };
  }

  const data = parsed.data;
  const supabase = createClient();

  const { data: protocol, error: insertError } = await supabase
    .from("maintenance_protocols")
    .insert({
      bike_id: data.bikeId,
      shop_id: data.shopId,
      mechanic_notes: data.mechanicNotes?.trim() || null,
      transmission_checked: data.transmissionChecked,
      brakes_checked: data.brakesChecked,
      bearings_checked: data.bearingsChecked,
      torque_checked: data.torqueChecked,
      photo_proof_url: data.photoProofUrl?.trim() || null,
    })
    .select("id")
    .single();

  if (insertError || !protocol) {
    return { success: false, error: insertError?.message ?? "No se pudo guardar el protocolo" };
  }

  const { error: resetError } = await supabase
    .from("bike_components")
    .update({ km_accumulated: 0, status: "green" })
    .eq("id", data.componentId)
    .eq("bike_id", data.bikeId);

  if (resetError) {
    return { success: false, error: resetError.message };
  }

  revalidatePath(`/app/bicicletas/${data.bikeId}`);
  revalidatePath("/dashboard/smartbike");

  return { success: true, protocolId: protocol.id };
}
