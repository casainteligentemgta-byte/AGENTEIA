import { createAdminClient } from "@/lib/supabase/admin";
import {
  aplicarTasaOficialAlPago,
  debeActualizarTasaOficial,
  tieneMontoParaConvertir,
} from "@/lib/importacion/pago-aranceles";
import { lookupTasaBcv, todayYmdCaracas } from "@/lib/importacion/tasa-bcv";
import {
  parseImportacion,
  serializeImportacion,
} from "@/lib/schemas/vehiculo-documentos";

export type TasaOficialDiariaResult = {
  tasa: number | null;
  fecha: string;
  scanned: number;
  updated: number;
  skipped: number;
  errors: string[];
};

/**
 * Convierte a Bs todos los precálculos pendientes con la tasa oficial BCV/SENIAT del día.
 * vehiculos.importacion es JSONB; cron usa service role (createAdminClient).
 */
export async function procesarTasaOficialDiaria(
  now = new Date()
): Promise<TasaOficialDiariaResult> {
  const hoy = todayYmdCaracas(now);
  const result: TasaOficialDiariaResult = {
    tasa: null,
    fecha: hoy,
    scanned: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const lookup = await lookupTasaBcv(hoy);
  if (!lookup) {
    result.errors.push("No se pudo leer la tasa oficial BCV del día");
    return result;
  }
  result.tasa = lookup.tasa;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vehiculos")
    .select("id, taller_id, importacion")
    .not("importacion", "is", null);
  if (error) {
    result.errors.push(error.message);
    return result;
  }

  for (const row of data ?? []) {
    result.scanned += 1;
    const existing = parseImportacion(row.importacion);
    if (!tieneMontoParaConvertir(existing)) {
      result.skipped += 1;
      continue;
    }
    if (!debeActualizarTasaOficial(existing, hoy)) {
      result.skipped += 1;
      continue;
    }
    const next = aplicarTasaOficialAlPago(existing, lookup);
    const { error: updateError } = await admin
      .from("vehiculos")
      .update({
        importacion: serializeImportacion(next),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("taller_id", row.taller_id);
    if (updateError) {
      result.errors.push(`${row.id}: ${updateError.message}`);
      continue;
    }
    result.updated += 1;
  }

  return result;
}
