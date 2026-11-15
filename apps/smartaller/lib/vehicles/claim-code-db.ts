import { isMissingSchemaError } from "@/lib/db/schema-errors";
import { generateClaimCode } from "@/lib/vehicles/claim-code";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function assignNewClaimCode(
  supabase: Admin,
  vehiculoId: string
): Promise<string | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateClaimCode();
    const { error } = await supabase
      .from("vehiculos")
      .update({
        codigo_reclamo: code,
        codigo_reclamo_generado_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", vehiculoId)
      .is("user_id", null);

    if (!error) return code;
    if (isMissingSchemaError(error.message)) return null;
    if (error.code === "23505") continue;
    console.error("assignNewClaimCode:", error.message);
    return null;
  }
  return null;
}

export async function ensureVehiculoClaimCode(
  supabase: Admin,
  vehiculoId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("vehiculos")
    .select("id, user_id, codigo_reclamo")
    .eq("id", vehiculoId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error.message)) return null;
    console.error("ensureVehiculoClaimCode:", error.message);
    return null;
  }
  if (!data || data.user_id) return null;
  if (typeof data.codigo_reclamo === "string" && data.codigo_reclamo.length > 0) {
    return data.codigo_reclamo;
  }
  return assignNewClaimCode(supabase, vehiculoId);
}

export async function clearVehiculoClaimCode(
  supabase: Admin,
  vehiculoId: string
): Promise<void> {
  const { error } = await supabase
    .from("vehiculos")
    .update({
      codigo_reclamo: null,
      codigo_reclamo_generado_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vehiculoId);

  if (error && !isMissingSchemaError(error.message)) {
    console.error("clearVehiculoClaimCode:", error.message);
  }
}
