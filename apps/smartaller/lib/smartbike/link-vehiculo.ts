import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BIKE_COMPONENT_TYPES,
  type BikeComponentType,
} from "@/lib/smartbike/types";

export const DEFAULT_BIKE_COMPONENT_LIMITS: Record<
  BikeComponentType,
  { brandModel: string; kmLimit: number }
> = {
  cadena: { brandModel: "Cadena estándar", kmLimit: 3000 },
  pastillas_freno: { brandModel: "Pastillas estándar", kmLimit: 2000 },
  neumatico: { brandModel: "Neumático estándar", kmLimit: 5000 },
  suspension: { brandModel: "Suspensión estándar", kmLimit: 5000 },
  rodamientos: { brandModel: "Rodamientos estándar", kmLimit: 8000 },
};

export type VehiculoBikeInput = {
  id: string;
  user_id: string;
  placa: string;
  nick?: string | null;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
};

export type EnsureBikeResult = {
  bikeId: string;
  created: boolean;
};

export async function ensureBikeForVehiculo(
  supabase: SupabaseClient,
  vehiculo: VehiculoBikeInput
): Promise<EnsureBikeResult | null> {
  const { data: byVehiculo } = await supabase
    .from("bikes")
    .select("id")
    .eq("vehiculo_id", vehiculo.id)
    .maybeSingle();

  if (byVehiculo) {
    return { bikeId: byVehiculo.id, created: false };
  }

  const { data: legacy } = await supabase
    .from("bikes")
    .select("id")
    .eq("user_id", vehiculo.user_id)
    .eq("frame_serial", vehiculo.placa)
    .maybeSingle();

  if (legacy) {
    await supabase
      .from("bikes")
      .update({ vehiculo_id: vehiculo.id })
      .eq("id", legacy.id);
    return { bikeId: legacy.id, created: false };
  }

  const brand = vehiculo.marca?.trim() || "Sin marca";
  const model =
    vehiculo.modelo?.trim() || vehiculo.nick?.trim() || "Bicicleta";

  const { data: bike, error } = await supabase
    .from("bikes")
    .insert({
      user_id: vehiculo.user_id,
      vehiculo_id: vehiculo.id,
      brand,
      model,
      frame_serial: vehiculo.placa,
      color: vehiculo.color?.trim() || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !bike) {
    console.error("ensureBikeForVehiculo:", error?.message);
    return null;
  }

  const components = BIKE_COMPONENT_TYPES.map((componentType) => ({
    bike_id: bike.id,
    component_type: componentType,
    brand_model: DEFAULT_BIKE_COMPONENT_LIMITS[componentType].brandModel,
    km_limit: DEFAULT_BIKE_COMPONENT_LIMITS[componentType].kmLimit,
  }));

  const { error: compError } = await supabase
    .from("bike_components")
    .insert(components);

  if (compError) {
    console.error("ensureBikeForVehiculo components:", compError.message);
  }

  return { bikeId: bike.id, created: true };
}

/** Resuelve UUID de bikes a partir de bike id o vehiculo id. */
export async function resolveBikeId(
  supabase: SupabaseClient,
  identifier: string
): Promise<string | null> {
  const { data: byBike } = await supabase
    .from("bikes")
    .select("id")
    .eq("id", identifier)
    .maybeSingle();

  if (byBike) return byBike.id;

  const { data: byVehiculo } = await supabase
    .from("bikes")
    .select("id")
    .eq("vehiculo_id", identifier)
    .maybeSingle();

  return byVehiculo?.id ?? null;
}
