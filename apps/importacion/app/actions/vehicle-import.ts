"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";
import { emptyCargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import type { VehicleImportDraft } from "@/lib/importacion/vehicle-import-draft";
import {
  dbRowToDraft,
  draftToDbColumns,
  isMissingDraftTableError,
} from "@/lib/importacion/vehicle-import-draft-db";
import { parseVinSources } from "@/lib/importacion/vehicle-import-vin";
import {
  parseTallerPreferencias,
  type TallerPreferencias,
} from "@/lib/taller-preferencias";
import {
  vehicleDraftInputSchema,
  type VehicleDraftInput,
} from "@/lib/validations/vehicle-import";

export type { VehicleDraftInput };

export type SaveVehicleImportDraftResult =
  | { ok: true; draft: VehicleImportDraft }
  | { ok: false; error: string };

async function requireTaller() {
  const user = await getUser();
  if (!user) return { error: "No autenticado" as const, taller: null, user: null };
  const taller = await getMyTaller();
  if (!taller) {
    return { error: "No se encontró tu taller" as const, taller: null, user };
  }
  return { error: null, taller, user };
}

async function loadPreferencias(tallerId: string): Promise<TallerPreferencias> {
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

function toDraft(input: VehicleDraftInput): VehicleImportDraft {
  return {
    importadorId: input.importadorId,
    step: input.step,
    currentVehicleIndex: input.currentVehicleIndex,
    facturaName: input.facturaName,
    certificadoNames: input.certificadoNames,
    rows: input.rows.map((row) =>
      emptyCargaMasivaRow(row as Parameters<typeof emptyCargaMasivaRow>[0])
    ),
    extractedFieldKeys: input.extractedFieldKeys,
    vinSources: parseVinSources(input.vinSources),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Valida el borrador, hace upsert en `vehicle_import_drafts` y devuelve el draft guardado.
 */
export async function saveVehicleImportDraft(
  data: VehicleDraftInput
): Promise<SaveVehicleImportDraftResult> {
  const auth = await requireTaller();
  if (auth.error || !auth.taller || !auth.user) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }

  const parsed = vehicleDraftInputSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Borrador inválido",
    };
  }

  const draft = toDraft(parsed.data);
  draft.updatedAt = new Date().toISOString();

  try {
    const admin = createAdminClient();
    const columns = draftToDbColumns(draft);
    const { data: saved, error } = await admin
      .from("vehicle_import_drafts")
      .upsert(
        {
          user_id: auth.user.id,
          taller_id: auth.taller.id,
          step: columns.step,
          vehicles: columns.vehicles,
          documents: columns.documents,
          updated_at: draft.updatedAt,
        },
        { onConflict: "user_id,taller_id" }
      )
      .select("step, vehicles, documents, updated_at")
      .maybeSingle();

    if (error && isMissingDraftTableError(error.message)) {
      const current = await loadPreferencias(auth.taller.id);
      await savePreferencias(auth.taller.id, {
        ...current,
        vehicleImportDraft: draft,
      });
      return { ok: true, draft };
    }
    if (error) return { ok: false, error: error.message };

    const current = await loadPreferencias(auth.taller.id);
    if (current.vehicleImportDraft) {
      await savePreferencias(auth.taller.id, {
        ...current,
        vehicleImportDraft: null,
      });
    }

    return { ok: true, draft: saved ? dbRowToDraft(saved) ?? draft : draft };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo guardar el borrador",
    };
  }
}

export async function saveVehicleImportDraftAction(
  data: VehicleDraftInput
): Promise<SaveVehicleImportDraftResult> {
  return saveVehicleImportDraft(data);
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
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("vehicle_import_drafts")
      .select("step, vehicles, documents, updated_at")
      .eq("user_id", auth.user.id)
      .eq("taller_id", auth.taller.id)
      .maybeSingle();

    if (error && isMissingDraftTableError(error.message)) {
      const current = await loadPreferencias(auth.taller.id);
      const draft = current.vehicleImportDraft ?? null;
      if (draft && draft.importadorId !== importadorId) {
        return { ok: true, draft: null };
      }
      return { ok: true, draft };
    }
    if (error) return { ok: false, error: error.message };

    const draft = data ? dbRowToDraft(data) : null;
    if (draft && importadorId && draft.importadorId !== importadorId) {
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
  if (auth.error || !auth.taller || !auth.user) {
    return { ok: false, error: auth.error ?? "No autorizado" };
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("vehicle_import_drafts")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("taller_id", auth.taller.id);
    if (error && !isMissingDraftTableError(error.message)) {
      return { ok: false, error: error.message };
    }
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
      error: err instanceof Error ? err.message : "No se pudo borrar el borrador",
    };
  }
}
