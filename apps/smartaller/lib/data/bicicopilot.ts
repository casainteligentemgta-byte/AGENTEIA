import { createClient } from "@/lib/supabase/server";
import type { Bike, BikeComponent, BikeWithComponents, Shop } from "@/lib/bicicopilot/types";

export async function getBikeWithComponents(
  bikeId: string
): Promise<BikeWithComponents | null> {
  const supabase = createClient();

  const { data: bike, error } = await supabase
    .from("bikes")
    .select(
      "id, user_id, shop_id, brand, model, frame_serial, color, size, material, status, strava_gear_id, created_at"
    )
    .eq("id", bikeId)
    .maybeSingle();

  if (error || !bike) return null;

  const { data: components } = await supabase
    .from("bike_components")
    .select(
      "id, bike_id, component_type, brand_model, accessory_serial, km_accumulated, km_limit, status, created_at"
    )
    .eq("bike_id", bikeId)
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
    ...(bike as Bike),
    shop,
    components: (components ?? []) as BikeComponent[],
  };
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
    .select(
      "id, user_id, shop_id, brand, model, frame_serial, color, size, material, status, strava_gear_id, created_at"
    )
    .order("created_at", { ascending: false });
  return (data ?? []) as Bike[];
}
