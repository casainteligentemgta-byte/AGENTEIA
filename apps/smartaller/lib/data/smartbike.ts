import { createClient } from "@/lib/supabase/server";
import { getUserVehiculoById } from "@/lib/data/user-vehicles";
import { ensureBikeForVehiculo } from "@/lib/smartbike/link-vehiculo";
import type { Bike, BikeComponent, BikeWithComponents, Shop } from "@/lib/smartbike/types";

const BIKE_SELECT =
  "id, user_id, vehiculo_id, shop_id, brand, model, frame_serial, color, size, material, status, strava_gear_id, created_at";

async function attachShopAndComponents(
  bike: Bike
): Promise<BikeWithComponents> {
  const supabase = createClient();

  const { data: components } = await supabase
    .from("bike_components")
    .select(
      "id, bike_id, component_type, brand_model, accessory_serial, km_accumulated, km_limit, status, created_at"
    )
    .eq("bike_id", bike.id)
    .order("component_type");

  let shop: Shop | null = null;
  if (bike.shop_id) {
    const { data: shopRow } = await supabase
      .from("shops")
      .select("id, name, logo_url, address, contact_phone")
      .eq("id", bike.shop_id)
      .maybeSingle();
    shop = shopRow as Shop | null;
  }

  return {
    ...bike,
    shop,
    components: (components ?? []) as BikeComponent[],
  };
}

export async function getBikeWithComponents(
  bikeId: string
): Promise<BikeWithComponents | null> {
  const supabase = createClient();

  const { data: bike, error } = await supabase
    .from("bikes")
    .select(BIKE_SELECT)
    .eq("id", bikeId)
    .maybeSingle();

  if (error || !bike) return null;
  return attachShopAndComponents(bike as Bike);
}

export async function getBikeByVehiculoId(
  vehiculoId: string
): Promise<Bike | null> {
  const supabase = createClient();

  const { data: bike, error } = await supabase
    .from("bikes")
    .select(BIKE_SELECT)
    .eq("vehiculo_id", vehiculoId)
    .maybeSingle();

  if (error || !bike) return null;
  return bike as Bike;
}

/** Obtiene o provisiona SmartBike para un vehículo tipo bicicleta del usuario. */
export async function getOrEnsureSmartBikeForVehiculo(
  vehiculoId: string
): Promise<BikeWithComponents | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const vehiculo = await getUserVehiculoById(vehiculoId);
  if (!vehiculo || vehiculo.tipo_vehiculo !== "bicicleta") return null;

  let bike = await getBikeByVehiculoId(vehiculoId);

  if (!bike) {
    const ensured = await ensureBikeForVehiculo(supabase, {
      id: vehiculo.id,
      user_id: user.id,
      placa: vehiculo.placa,
      nick: vehiculo.nick,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      color: vehiculo.color,
    });
    if (!ensured) return null;
    bike = await getBikeByVehiculoId(vehiculoId);
    if (!bike) return null;
  }

  return attachShopAndComponents(bike);
}

export async function getShops(): Promise<Shop[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("shops")
    .select("id, name, logo_url, address, contact_phone")
    .order("name");
  return (data ?? []) as Shop[];
}

export async function getUserBikes(): Promise<Bike[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("bikes")
    .select(BIKE_SELECT)
    .order("created_at", { ascending: false });
  return (data ?? []) as Bike[];
}
