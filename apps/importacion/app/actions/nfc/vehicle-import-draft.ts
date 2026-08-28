"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import {
  parseTallerPreferencias,
  type TallerPreferencias,
} from "@/lib/taller-preferencias";
import type { VehicleImportDraft } from "@/lib/importacion/vehicle-import-draft";
import {
  dbRowToDraft,
  draftToDbColumns,
  isMissingDraftTableError,
} from "@/lib/importacion/vehicle-import-draft-db";

async function requireTaller() {
  const user = await getUser();
  if (!user) return { error: "No autenticado" as const, taller: null, user: null };
  const taller = await getMyTaller();
  if (!taller) {
    return { error: "No se encontró tu taller" as const, taller: null, user };
  }
  return { error: null, taller, user };
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

async function upsertDraftTable(
  userId: string,
  tallerId: string,
  draft: VehicleImportDraft
): Promise<{ ok: true } | { missingTable: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const columns = draftToDbColumns(draft);
  const { error } = await admin.from("vehicle_import_drafts").upsert(
    {
      user_id: userId,
      taller_id: tallerId,
      step: columns.step,
      vehicles: columns.vehicles,
      documents: columns.documents,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,taller_id" }
  );
  if (error) {
    if (isMissingDraftTableError(error.message)) return { missingTable: true };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

async function readDraftTable(
  userId: string,
  tallerId: string
): Promise<
  | { ok: true; draft: VehicleImportDraft | null }
  | { missingTable: true }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehicle_import_drafts")
    .select("step, vehicles, documents, updated_at")
    .eq("user_id", userId)
    .eq("taller_id", tallerId)
    .maybeSingle();
  if (error) {
    if (isMissingDraftTableError(error.message)) return { missingTable: true };
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: true, draft: null };
  return { ok: true, draft: dbRowToDraft(data) };
}

async function deleteDraftTable(
  userId: string,
  tallerId: string
): Promise<{ ok: true } | { missingTable: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("vehicle_import_drafts")
    .delete()
    .eq("user_id", userId)
    .eq("taller_id", tallerId);
  if (error) {
    if (isMissingDraftTableError(error.message)) return { missingTable: true };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function saveVehicleImportDraft(data: VehicleImportDraft) {
  return saveVehicleImportDraftAction(data);
}

export async function saveVehicleImportDraftAction(
  draft: VehicleImportDraft
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireTaller();
  if (auth.error || !auth.taller || !auth.user) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  if (draft.importadorId.trim().length === 0) {
    return { ok: false, error: "Falta el cliente de la importación" };
  }
  try {
    const table = await upsertDraftTable(auth.user.id, auth.taller.id, draft);
    if ("missingTable" in table) {
      const current = await loadPreferencias(auth.taller.id);
      await savePreferencias(auth.taller.id, {
        ...current,
        vehicleImportDraft: {
          ...draft,
          updatedAt: new Date().toISOString(),
        },
      });
      return { ok: true };
    }
    if (!table.ok) return table;
    const current = await loadPreferencias(auth.taller.id);
    if (current.vehicleImportDraft) {
      await savePreferencias(auth.taller.id, {
        ...current,
        vehicleImportDraft: null,
      });
    }
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
  if (auth.error || !auth.taller || !auth.user) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  try {
    const table = await readDraftTable(auth.user.id, auth.taller.id);
    if ("ok" in table && table.ok) {
      const draft = table.draft;
      if (draft && importadorId && draft.importadorId !== importadorId) {
        return { ok: true, draft: null };
      }
      return { ok: true, draft };
    }
    if ("missingTable" in table) {
      const current = await loadPreferencias(auth.taller.id);
      const draft = current.vehicleImportDraft ?? null;
      if (draft && draft.importadorId !== importadorId) {
        return { ok: true, draft: null };
      }
      return { ok: true, draft };
    }
    return { ok: false, error: table.error };
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
  if (auth.error || !auth.taller || !auth.user) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  try {
    const table = await deleteDraftTable(auth.user.id, auth.taller.id);
    const current = await loadPreferencias(auth.taller.id);
    if (current.vehicleImportDraft) {
      await savePreferencias(auth.taller.id, {
        ...current,
        vehicleImportDraft: null,
      });
    }
    if ("ok" in table && !table.ok) return table;
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo borrar el borrador",
    };
  }
}
