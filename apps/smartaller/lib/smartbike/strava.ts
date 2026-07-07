import { createAdminClient } from "@/lib/supabase/admin";
import { statusFromWear } from "@/lib/smartbike/component-wear";
import type { BikeComponent } from "@/lib/smartbike/types";

export type StravaActivityResult =
  | { success: true; bikeId: string; kmAdded: number; updatedComponents: number }
  | { success: false; error: string };

/**
 * Procesa actividad Strava: suma km a todos los componentes de la bicicleta
 * y recalcula el semáforo de desgaste.
 */
export async function processStravaActivity(
  bicycleId: string,
  distanceMeters: number
): Promise<StravaActivityResult> {
  const kmAdded = distanceMeters / 1000;
  if (kmAdded <= 0) {
    return { success: false, error: "Distancia inválida" };
  }

  const supabase = createAdminClient();

  const { data: bike, error: bikeError } = await supabase
    .from("bikes")
    .select("id")
    .eq("id", bicycleId)
    .maybeSingle();

  if (bikeError || !bike) {
    return { success: false, error: "Bicicleta no encontrada" };
  }

  const { data: components, error: compError } = await supabase
    .from("bike_components")
    .select("id, km_accumulated, km_limit")
    .eq("bike_id", bicycleId);

  if (compError) {
    return { success: false, error: compError.message };
  }

  if (!components?.length) {
    return { success: false, error: "La bicicleta no tiene componentes registrados" };
  }

  let updated = 0;
  for (const comp of components) {
    const newKm = Number(comp.km_accumulated) + kmAdded;
    const newStatus = statusFromWear(newKm, Number(comp.km_limit));

    const { error: updateError } = await supabase
      .from("bike_components")
      .update({
        km_accumulated: newKm,
        status: newStatus,
      })
      .eq("id", comp.id);

    if (!updateError) updated += 1;
  }

  return {
    success: true,
    bikeId: bicycleId,
    kmAdded,
    updatedComponents: updated,
  };
}

export function componentsNeedingAlert(components: BikeComponent[]): BikeComponent[] {
  return components.filter((c) => c.status === "yellow" || c.status === "red");
}
