import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import {
  DIAGNOSTICOS_BUCKET,
  RECEPCION_ESTADO_VISUAL_BUCKET,
  VEHICULOS_DOCUMENTOS_BUCKET,
  type PrivateStorageBucket,
} from "@/lib/storage/buckets";
import { isSafeStoragePath } from "@/lib/storage/signed-url";

export async function canAccessPrivateStoragePath(
  bucket: PrivateStorageBucket,
  path: string
): Promise<boolean> {
  if (!isSafeStoragePath(path)) return false;

  const user = await getUser();
  if (!user) return false;

  const taller = await getMyTaller();
  if (taller && path.startsWith(`${taller.id}/`)) {
    return true;
  }
  if (
    taller &&
    bucket === VEHICULOS_DOCUMENTOS_BUCKET &&
    path.startsWith("demo-plantillas/")
  ) {
    return true;
  }

  const segments = path.split("/");
  const admin = createAdminClient();

  if (bucket === DIAGNOSTICOS_BUCKET) {
    const mantenimientoId = segments[1];
    if (!mantenimientoId) return false;
    const { data: mantenimiento } = await admin
      .from("mantenimientos")
      .select("vehiculo_id")
      .eq("id", mantenimientoId)
      .maybeSingle();
    if (!mantenimiento?.vehiculo_id) return false;
    const { data: vehiculo } = await admin
      .from("vehiculos")
      .select("user_id")
      .eq("id", mantenimiento.vehiculo_id)
      .maybeSingle();
    return vehiculo?.user_id === user.id;
  }

  if (bucket === RECEPCION_ESTADO_VISUAL_BUCKET || bucket === VEHICULOS_DOCUMENTOS_BUCKET) {
    const maybeVehiculoId = segments[1];
    if (!maybeVehiculoId || maybeVehiculoId === "temp" || maybeVehiculoId === "ocr-temp") {
      return false;
    }
    const { data: vehiculo } = await admin
      .from("vehiculos")
      .select("user_id")
      .eq("id", maybeVehiculoId)
      .maybeSingle();
    return vehiculo?.user_id === user.id;
  }

  return false;
}
