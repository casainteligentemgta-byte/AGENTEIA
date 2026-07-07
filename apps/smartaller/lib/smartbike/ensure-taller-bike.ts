import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser, type Taller } from "@/lib/taller";
import { ensureBikeForVehiculo, resolveBikeId } from "@/lib/smartbike/link-vehiculo";

type VehiculoRow = {
  id: string;
  placa: string;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  nick: string | null;
  user_id: string | null;
  tipo_vehiculo: string;
  taller_id: string | null;
};

export type EnsureTallerBikeResult =
  | { ok: true; bikeId: string }
  | { ok: false; error: string };

async function ensureShopForTaller(
  admin: ReturnType<typeof createAdminClient>,
  taller: Taller
): Promise<string | null> {
  const { data: byName } = await admin
    .from("shops")
    .select("id")
    .eq("name", taller.nombre)
    .maybeSingle();

  if (byName?.id) return byName.id;

  const { data: created, error } = await admin
    .from("shops")
    .insert({ name: taller.nombre })
    .select("id")
    .single();

  if (error || !created) {
    console.error("ensureShopForTaller:", error?.message);
    return null;
  }

  return created.id;
}

async function provisionBikeForVehiculo(
  admin: ReturnType<typeof createAdminClient>,
  vehiculo: VehiculoRow,
  bikeUserId: string,
  shopId: string
): Promise<string | null> {
  const ensured = await ensureBikeForVehiculo(admin, {
    id: vehiculo.id,
    user_id: bikeUserId,
    placa: vehiculo.placa,
    nick: vehiculo.nick,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    color: vehiculo.color,
  });

  if (!ensured) return null;

  const { error } = await admin
    .from("bikes")
    .update({ shop_id: shopId, vehiculo_id: vehiculo.id })
    .eq("id", ensured.bikeId);

  if (error) {
    console.error("provisionBikeForVehiculo shop:", error.message);
    return null;
  }

  return ensured.bikeId;
}

/**
 * Prepara bicicleta + shop del taller para el protocolo SmartBike en dashboard B2B.
 */
export async function ensureTallerBikeReady(
  identifier: string
): Promise<EnsureTallerBikeResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Debes iniciar sesión" };

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const admin = createAdminClient();
  const shopId = await ensureShopForTaller(admin, taller);
  if (!shopId) {
    return { ok: false, error: "No se pudo configurar el taller SmartBike" };
  }

  const { data: vehiculoById } = await admin
    .from("vehiculos")
    .select(
      "id, placa, marca, modelo, color, nick, user_id, tipo_vehiculo, taller_id"
    )
    .eq("id", identifier)
    .eq("taller_id", taller.id)
    .maybeSingle();

  if (vehiculoById) {
    if (vehiculoById.tipo_vehiculo !== "bicicleta") {
      return { ok: false, error: "El protocolo SmartBike solo aplica a bicicletas" };
    }

    const bikeUserId = vehiculoById.user_id ?? taller.owner_user_id;
    const bikeId = await provisionBikeForVehiculo(
      admin,
      vehiculoById as VehiculoRow,
      bikeUserId,
      shopId
    );

    if (!bikeId) {
      return { ok: false, error: "No se pudo preparar el carnet SmartBike" };
    }

    return { ok: true, bikeId };
  }

  const resolvedBikeId = await resolveBikeId(admin, identifier);
  if (!resolvedBikeId) {
    return { ok: false, error: "Bicicleta no encontrada en tu flota" };
  }

  const { data: bike } = await admin
    .from("bikes")
    .select("id, vehiculo_id, shop_id")
    .eq("id", resolvedBikeId)
    .maybeSingle();

  if (!bike) {
    return { ok: false, error: "Bicicleta no encontrada" };
  }

  if (bike.vehiculo_id) {
    const { data: vehiculo } = await admin
      .from("vehiculos")
      .select("taller_id, tipo_vehiculo")
      .eq("id", bike.vehiculo_id)
      .maybeSingle();

    if (!vehiculo || vehiculo.taller_id !== taller.id) {
      return { ok: false, error: "Esta bicicleta no pertenece a tu flota" };
    }
  }

  if (!bike.shop_id) {
    await admin.from("bikes").update({ shop_id: shopId }).eq("id", resolvedBikeId);
  }

  return { ok: true, bikeId: resolvedBikeId };
}
