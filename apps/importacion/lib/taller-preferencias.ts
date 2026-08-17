import { createAdminClient } from "@/lib/supabase/admin";
import { parseImportacion } from "@/lib/schemas/vehiculo-documentos";

export type UltimoImportador = {
  importadorNombre: string;
  importadorDocumento: string;
  importadorTelefono: string;
  importadorEmail: string;
  importadorDireccion: string;
};

export type TallerPreferencias = {
  ultimoImportador?: UltimoImportador | null;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseUltimoImportador(raw: unknown): UltimoImportador | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const importadorNombre = asString(
    o.importadorNombre ?? o.importador_nombre ?? o.nombre
  );
  if (!importadorNombre) return null;
  return {
    importadorNombre,
    importadorDocumento: asString(
      o.importadorDocumento ?? o.importador_documento ?? o.documento
    ),
    importadorTelefono: asString(
      o.importadorTelefono ?? o.importador_telefono ?? o.telefono
    ),
    importadorEmail: asString(
      o.importadorEmail ?? o.importador_email ?? o.email
    ),
    importadorDireccion: asString(
      o.importadorDireccion ?? o.importador_direccion ?? o.direccion
    ),
  };
}

export function parseTallerPreferencias(raw: unknown): TallerPreferencias {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    ultimoImportador: parseUltimoImportador(o.ultimoImportador ?? o.ultimo_importador),
  };
}

export function ultimoImportadorFromAlta(data: {
  importadorNombre?: string | null;
  importadorDocumento?: string | null;
  importadorTelefono?: string | null;
  importadorEmail?: string | null;
  importadorDireccion?: string | null;
}): UltimoImportador | null {
  const importadorNombre = data.importadorNombre?.trim() ?? "";
  if (!importadorNombre) return null;
  return {
    importadorNombre,
    importadorDocumento: data.importadorDocumento?.trim() ?? "",
    importadorTelefono: data.importadorTelefono?.trim() ?? "",
    importadorEmail: data.importadorEmail?.trim() ?? "",
    importadorDireccion: data.importadorDireccion?.trim() ?? "",
  };
}

/**
 * Lee el importador guardado en preferencias del taller.
 * Si no hay, usa el del último vehículo Puerto Libre con importador.
 */
export async function getUltimoImportadorTaller(
  tallerId: string
): Promise<UltimoImportador | null> {
  const admin = createAdminClient();

  const { data: taller, error } = await admin
    .from("talleres")
    .select("preferencias")
    .eq("id", tallerId)
    .maybeSingle();

  if (!error && taller) {
    const prefs = parseTallerPreferencias(
      (taller as { preferencias?: unknown }).preferencias
    );
    if (prefs.ultimoImportador?.importadorNombre) {
      return prefs.ultimoImportador;
    }
  }

  // Fallback: último expediente con importador (sirve antes de migración o sin prefs).
  const { data: rows } = await admin
    .from("vehiculos")
    .select("importacion, created_at")
    .eq("taller_id", tallerId)
    .order("created_at", { ascending: false })
    .limit(25);

  for (const row of rows ?? []) {
    const imp = parseImportacion(row.importacion);
    const nombre = imp.importadorNombre?.trim() ?? "";
    if (!nombre) continue;
    return {
      importadorNombre: nombre,
      importadorDocumento: imp.importadorDocumento?.trim() ?? "",
      importadorTelefono: imp.importadorTelefono?.trim() ?? "",
      importadorEmail: imp.importadorEmail?.trim() ?? "",
      importadorDireccion: imp.importadorDireccion?.trim() ?? "",
    };
  }

  return null;
}

/** Persiste el último importador en talleres.preferencias (no falla el flujo si falta la columna). */
export async function saveUltimoImportadorTaller(
  tallerId: string,
  importador: UltimoImportador
): Promise<void> {
  const cleaned = parseUltimoImportador(importador);
  if (!cleaned) return;

  try {
    const admin = createAdminClient();
    const { data: taller } = await admin
      .from("talleres")
      .select("preferencias")
      .eq("id", tallerId)
      .maybeSingle();

    const current = parseTallerPreferencias(
      (taller as { preferencias?: unknown } | null)?.preferencias
    );
    const next: TallerPreferencias = {
      ...current,
      ultimoImportador: cleaned,
    };

    const { error } = await admin
      .from("talleres")
      .update({
        preferencias: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tallerId);

    if (error && /preferencias|column/i.test(error.message)) {
      // Migración aún no aplicada: el fallback por último vehículo cubre la lectura.
      return;
    }
  } catch {
    // No bloquear el alta si falla el guardado de preferencias.
  }
}

/** Rellena campos de importador vacíos con el último guardado. */
export function applyImportadorDefaults<
  T extends {
    importadorNombre?: string;
    importadorDocumento?: string;
    importadorTelefono?: string;
    importadorEmail?: string;
    importadorDireccion?: string;
  },
>(row: T, defaults: UltimoImportador | null): T {
  if (!defaults) return row;
  return {
    ...row,
    importadorNombre: row.importadorNombre?.trim()
      ? row.importadorNombre
      : defaults.importadorNombre,
    importadorDocumento: row.importadorDocumento?.trim()
      ? row.importadorDocumento
      : defaults.importadorDocumento,
    importadorTelefono: row.importadorTelefono?.trim()
      ? row.importadorTelefono
      : defaults.importadorTelefono,
    importadorEmail: row.importadorEmail?.trim()
      ? row.importadorEmail
      : defaults.importadorEmail,
    importadorDireccion: row.importadorDireccion?.trim()
      ? row.importadorDireccion
      : defaults.importadorDireccion,
  };
}
