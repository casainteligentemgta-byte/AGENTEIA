"use server";

import { revalidatePath } from "next/cache";
import { createPuertoLibreVehiculoAction } from "@/app/actions/nfc/importacion-vehiculo";
import { ensureImportadorForTaller } from "@/app/actions/nfc/importadores";
import {
  DEMO_FASES,
  demoFaseMotorFromTallerId,
  demoFaseSerialFromTallerId,
  demoFaseSpec,
  type DemoFase,
  type DemoFaseSpec,
} from "@/lib/importacion/demo-fases";
import {
  DEMO_IMPORTADOR_NOMBRE,
  demoRifFromTallerId,
} from "@/lib/importacion/demo-plantillas";
import {
  parseImportacion,
  serializeImportacion,
} from "@/lib/schemas/vehiculo-documentos";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { getMyTaller } from "@/lib/taller";

type ActionErr = { success: false; error: string };

export type DemoFaseVehiculo = {
  id: string;
  fase: DemoFase;
  etiqueta: string;
  color: string;
  codigoExpediente: string | null;
  serialCarroceria: string;
  numeroBl: string | null;
  planillaFase: number;
};

const VEHICULO_SELECT = "id, color, serial_carroceria, importacion";

async function requireTallerAuth() {
  const user = await getUser();
  if (!user) {
    return { error: "Debes iniciar sesión" as const, taller: null };
  }
  const taller = await getMyTaller();
  if (!taller) {
    return { error: "No se encontró tu taller" as const, taller: null };
  }
  return { error: null, taller };
}

async function loadBySerial(tallerId: string, serial: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select(VEHICULO_SELECT)
    .eq("taller_id", tallerId)
    .eq("serial_carroceria", serial)
    .maybeSingle();
  if (error) return { error: error.message, row: null };
  return { error: null, row: data };
}

function mapRow(
  spec: DemoFaseSpec,
  row: {
    id: string;
    color: string | null;
    serial_carroceria: string | null;
    importacion: unknown;
  }
): DemoFaseVehiculo {
  const imp = parseImportacion(row.importacion);
  return {
    id: row.id,
    fase: spec.fase,
    etiqueta: spec.etiqueta,
    color: row.color ?? spec.color,
    codigoExpediente: imp.codigoExpediente ?? null,
    serialCarroceria: row.serial_carroceria ?? "",
    numeroBl: imp.numeroBl ?? spec.numeroBl,
    planillaFase: imp.planillaFase ?? spec.fase,
  };
}

async function applyDemoFase(
  tallerId: string,
  vehiculoId: string,
  spec: DemoFaseSpec
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const { data: row, error: loadError } = await admin
    .from("vehiculos")
    .select("importacion")
    .eq("id", vehiculoId)
    .eq("taller_id", tallerId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!row) return { error: "Expediente no encontrado" };

  const imp = parseImportacion(row.importacion);
  const { error } = await admin
    .from("vehiculos")
    .update({
      color: spec.color,
      importacion: serializeImportacion({
        ...imp,
        planillaFase: spec.fase,
        completitudDatos: spec.completitudDatos,
        datosPendientes: spec.datosPendientes,
        numeroBl: spec.numeroBl,
        fechaLlegadaBuque: spec.fechaLlegadaBuque,
        fechaIngreso: spec.fechaIngreso,
        partidaArancelaria: spec.partidaArancelaria,
        observaciones: spec.observaciones,
        paisOrigen: imp.paisOrigen || "Japón",
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", vehiculoId)
    .eq("taller_id", tallerId);
  return { error: error?.message ?? null };
}

/**
 * Crea (o reubica) expedientes de prueba: uno en cada cola 1–10.
 * RLS: service role tras requireTallerAuth; solo escribe en ese taller_id.
 */
export async function ensureDemoFasesAction(): Promise<
  | {
      success: true;
      created: number;
      updated: number;
      vehiculos: DemoFaseVehiculo[];
    }
  | ActionErr
> {
  const auth = await requireTallerAuth();
  if (auth.error || !auth.taller) {
    return { success: false, error: auth.error ?? "No autorizado" };
  }

  const tallerId = auth.taller.id;
  const rif = demoRifFromTallerId(tallerId);
  const importador = await ensureImportadorForTaller({
    tallerId,
    nombre: DEMO_IMPORTADOR_NOMBRE,
    documento: rif,
    tipo: "juridica",
    direccion: "Av. 4 de Mayo, Porlamar, Nueva Esparta",
  });
  if (!importador.ok) {
    return { success: false, error: importador.error };
  }

  let created = 0;
  let updated = 0;
  const vehiculos: DemoFaseVehiculo[] = [];

  for (const fase of DEMO_FASES) {
    const spec = demoFaseSpec(tallerId, fase);
    const serial = demoFaseSerialFromTallerId(tallerId, fase);
    const existing = await loadBySerial(tallerId, serial);
    if (existing.error) return { success: false, error: existing.error };

    let vehiculoId = existing.row?.id ?? null;
    if (!vehiculoId) {
      const createdRow = await createPuertoLibreVehiculoAction({
        marca: spec.marca,
        modelo: spec.modelo,
        color: spec.color,
        anio: spec.anio,
        serialMotor: demoFaseMotorFromTallerId(tallerId, fase),
        vin: serial,
        serialCarroceria: serial,
        kilometraje: 0,
        condicion: "nuevo",
        esSubasta: false,
        tipoCombustible: "diesel",
        fechaLlegadaBuque: spec.fechaLlegadaBuque ?? "",
        regimen: "puerto_libre",
        importadorId: importador.importadorId,
        importadorNombre: DEMO_IMPORTADOR_NOMBRE,
        paisOrigen: "Japón",
        numeroBl: spec.numeroBl ?? "",
        partidaArancelaria: spec.partidaArancelaria ?? "",
        observaciones: spec.observaciones,
      });
      if (!createdRow.success) {
        const again = await loadBySerial(tallerId, serial);
        if (!again.row) {
          return { success: false, error: createdRow.error };
        }
        vehiculoId = again.row.id;
      } else {
        vehiculoId = createdRow.vehiculoId;
        created += 1;
      }
    } else {
      updated += 1;
    }

    const applied = await applyDemoFase(tallerId, vehiculoId, spec);
    if (applied.error) return { success: false, error: applied.error };

    const reloaded = await loadBySerial(tallerId, serial);
    if (reloaded.error || !reloaded.row) {
      return {
        success: false,
        error: reloaded.error ?? "No se pudo recargar el expediente de prueba",
      };
    }
    vehiculos.push(mapRow(spec, reloaded.row));
  }

  revalidatePath("/smartimport");
  revalidatePath("/smartimport/demo-fases");
  return { success: true, created, updated, vehiculos };
}
