"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePortalAccess } from "@/lib/portal/roles";
import {
  canAccessAllImportacionData,
  isDataAdmin,
  isMasterAdmin,
} from "@/lib/importacion/access";

const shareSchema = z.object({
  vehiculoId: z.string().uuid(),
  userId: z.string().uuid(),
});

function canShareVehicles(
  access: NonNullable<Awaited<ReturnType<typeof resolvePortalAccess>>>
): boolean {
  return isMasterAdmin(access) || isDataAdmin(access) || canAccessAllImportacionData(access);
}

/** Comparte un vehículo con un usuario (además de vehiculos.user_id). */
export async function shareVehiculoWithUserAction(
  input: z.infer<typeof shareSchema>
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = shareSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const access = await resolvePortalAccess();
  if (!access || !canShareVehicles(access)) {
    return { success: false, error: "No autorizado para compartir vehículos." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("vehiculo_compartidos").upsert(
    {
      vehiculo_id: parsed.data.vehiculoId,
      user_id: parsed.data.userId,
      shared_by: access.userId,
    },
    { onConflict: "vehiculo_id,user_id" }
  );

  if (error) {
    if (error.code === "42P01") {
      return {
        success: false,
        error:
          "Falta la tabla vehiculo_compartidos. Ejecuta la migración de roles/importación.",
      };
    }
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** IDs de vehículos propios o compartidos con el usuario actual. */
export async function listUsuarioVehiculoIdsAction(): Promise<
  | { success: true; vehiculoIds: string[] }
  | { success: false; error: string }
> {
  const access = await resolvePortalAccess();
  if (!access) return { success: false, error: "No autenticado" };

  const admin = createAdminClient();
  const [{ data: owned }, { data: shared }] = await Promise.all([
    admin.from("vehiculos").select("id").eq("user_id", access.userId),
    admin
      .from("vehiculo_compartidos")
      .select("vehiculo_id")
      .eq("user_id", access.userId),
  ]);

  const ids = new Set<string>();
  for (const row of owned ?? []) {
    if (typeof row.id === "string") ids.add(row.id);
  }
  for (const row of shared ?? []) {
    if (typeof row.vehiculo_id === "string") ids.add(row.vehiculo_id);
  }

  return { success: true, vehiculoIds: [...ids] };
}
