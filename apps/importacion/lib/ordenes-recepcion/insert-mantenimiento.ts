import type { createAdminClient } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function isSchemaCacheError(message?: string): boolean {
  return Boolean(message?.includes("schema cache"));
}

export async function insertMantenimientoOrdenRecepcion(
  supabase: SupabaseAdmin,
  rows: Record<string, unknown>[]
): Promise<{ id: string }> {
  let lastError: string | undefined;

  for (const row of rows) {
    const { data, error } = await supabase
      .from("mantenimientos")
      .insert(row)
      .select("id")
      .single();

    if (!error && data) {
      return { id: data.id as string };
    }

    lastError = error?.message;
    if (!isSchemaCacheError(lastError)) {
      throw new Error(lastError ?? "No se pudo vincular el mantenimiento");
    }
  }

  throw new Error(lastError ?? "No se pudo vincular el mantenimiento");
}
