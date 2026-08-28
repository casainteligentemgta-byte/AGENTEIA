"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import {
  parseTallerPreferencias,
  type TallerPreferencias,
} from "@/lib/taller-preferencias";
import type { VehicleImportDraft } from "@/lib/importacion/vehicle-import-draft";

async function requireTaller() {
  const user = await getUser();
  if (!user) return { error: "No autenticado" as const, taller: null };
  const taller = await getMyTaller();
  if (!taller) return { error: "No se encontró tu taller" as const, taller: null };
  return { error: null, taller };
}

async function loadPreferencias(
  tallerId: string
): Promise<TallerPreferencias> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("talleres")
    .select("preferencias")
    .eq("id", tallerId)
    .maybeSingle();
  return parseTallerPreferencias(
    (data as { preferencias?: unknown } | null)?.preferencias
  );
}

async function savePreferencias(
  tallerId: string,
  next: TallerPreferencias
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("talleres")
    .update({
      preferencias: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tallerId);
  if (error && /preferencias|column/i.test(error.message)) return;
  if (error) throw new Error(error.message);
}

export async function saveVehicleImportDraftAction(
  draft: VehicleImportDraft
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireTaller();
  if (auth.error || !auth.taller) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  if (draft.importadorId.trim().length === 0) {
    return { ok: false, error: "Falta el cliente de la importación" };
  }
  try {
    const current = await loadPreferencias(auth.taller.id);
    await savePreferencias(auth.taller.id, {
      ...current,
      vehicleImportDraft: {
        ...draft,
        updatedAt: new Date().toISOString(),
      },
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo guardar el borrador",
    };
  }
}

export async function loadVehicleImportDraftAction(
  importadorId: string
): Promise<
  | { ok: true; draft: VehicleImportDraft | null }
  | { ok: false; error: string }
> {
  const auth = await requireTaller();
  if (auth.error || !auth.taller) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  try {
    const current = await loadPreferencias(auth.taller.id);
    const draft = current.vehicleImportDraft ?? null;
    if (draft && draft.importadorId !== importadorId) {
      return { ok: true, draft: null };
    }
    return { ok: true, draft };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo leer el borrador",
    };
  }
}

export async function clearVehicleImportDraftAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const auth = await requireTaller();
  if (auth.error || !auth.taller) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  try {
    const current = await loadPreferencias(auth.taller.id);
    await savePreferencias(auth.taller.id, {
      ...current,
      vehicleImportDraft: null,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo borrar el borrador",
    };
  }
}
