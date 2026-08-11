import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS,
  getNormaByRegla,
} from "@/lib/importacion/normas-legales";
import { getRegimenConfig } from "@/lib/importacion/regimenes";
import { parseImportacion } from "@/lib/schemas/vehiculo-documentos";
import { isValidRif, normalizeRif } from "@/lib/validations/rif";
import { resolveCodigoExpediente } from "@/lib/importacion/expediente";

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const VENTANA_ANIOS = 3;

export type TipoPersonaImportador = "natural" | "juridica" | "desconocido";

export type CumplimientoConflicto = {
  vehiculoId: string;
  codigoExpediente: string | null;
  fechaReferencia: string;
  marca: string | null;
  modelo: string | null;
};

export type CumplimientoResultado =
  | { ok: true; aplicable: boolean; tipo: TipoPersonaImportador }
  | {
      ok: false;
      aplicable: true;
      tipo: "natural";
      reglaCodigo: typeof REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS;
      error: string;
      conflictos: CumplimientoConflicto[];
    };

/** Persona natural: RIF con letra V o E. Jurídica: J, G, C, P. */
export function clasificarTipoImportadorPorRif(
  documento: string | null | undefined
): TipoPersonaImportador {
  if (!documento?.trim()) return "desconocido";
  const rif = normalizeRif(documento);
  if (!isValidRif(rif)) return "desconocido";
  const letra = rif[0]!;
  if (letra === "V" || letra === "E") return "natural";
  if (letra === "J" || letra === "G" || letra === "C" || letra === "P") {
    return "juridica";
  }
  return "desconocido";
}

function parseFechaReferencia(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const t = new Date(iso);
    return Number.isNaN(t.getTime()) ? null : t;
  }
  const [y, m, day] = d.split("-").map(Number);
  const date = new Date(y!, m! - 1, day!);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Fecha usada para el cupo: ingreso PL → llegada buque → created_at. */
export function fechaReferenciaImportacion(params: {
  fechaIngreso?: string | null;
  fechaLlegadaBuque?: string | null;
  createdAt?: string | null;
}): { iso: string; date: Date } | null {
  const candidates = [
    params.fechaIngreso,
    params.fechaLlegadaBuque,
    params.createdAt,
  ];
  for (const c of candidates) {
    const date = parseFechaReferencia(c);
    if (date) {
      return { iso: c!.slice(0, 10), date };
    }
  }
  return null;
}

function dentroDeVentana3Anios(fecha: Date, ahora = new Date()): boolean {
  const limite = new Date(ahora);
  limite.setFullYear(limite.getFullYear() - VENTANA_ANIOS);
  return fecha.getTime() >= limite.getTime();
}

/**
 * Evalúa la regla: persona natural ≤ 1 vehículo en menos de 3 años (mismo taller + RIF).
 * Si el RIF no es de persona natural o falta, no bloquea (no aplicable).
 */
export async function evaluarCupoPersonaNatural(params: {
  admin: SupabaseClient;
  tallerId: string;
  importadorDocumento: string | null | undefined;
  excludeVehiculoId?: string | null;
  /** Fecha de referencia del alta en curso (llegada buque si ya se conoce). */
  fechaReferenciaNueva?: string | null;
  /** Régimen del alta/edición en curso. */
  regimen?: string | null;
}): Promise<CumplimientoResultado> {
  if (!getRegimenConfig(params.regimen).aplicaCupoPersonaNatural) {
    return {
      ok: true,
      aplicable: false,
      tipo: clasificarTipoImportadorPorRif(params.importadorDocumento),
    };
  }

  const tipo = clasificarTipoImportadorPorRif(params.importadorDocumento);
  if (tipo !== "natural") {
    return { ok: true, aplicable: false, tipo };
  }

  const rif = normalizeRif(params.importadorDocumento!);
  const { data, error } = await params.admin
    .from("vehiculos")
    .select("id, placa, marca, modelo, created_at, importacion")
    .eq("taller_id", params.tallerId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return {
      ok: false,
      aplicable: true,
      tipo: "natural",
      reglaCodigo: REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS,
      error: `No se pudo verificar el cupo legal: ${error.message}`,
      conflictos: [],
    };
  }

  const ahora = new Date();
  const refNueva =
    fechaReferenciaImportacion({
      fechaLlegadaBuque: params.fechaReferenciaNueva,
      createdAt: ahora.toISOString(),
    })?.date ?? ahora;

  const conflictos: CumplimientoConflicto[] = [];

  for (const row of data ?? []) {
    if (params.excludeVehiculoId && row.id === params.excludeVehiculoId) {
      continue;
    }
    const imp = parseImportacion(row.importacion);
    if (!getRegimenConfig(imp.regimen).aplicaCupoPersonaNatural) continue;
    const doc = imp.importadorDocumento
      ? normalizeRif(imp.importadorDocumento)
      : "";
    if (!doc || doc !== rif) continue;

    const ref = fechaReferenciaImportacion({
      fechaIngreso: imp.fechaIngreso,
      fechaLlegadaBuque: imp.fechaLlegadaBuque,
      createdAt: row.created_at as string,
    });
    if (!ref) continue;
    if (!dentroDeVentana3Anios(ref.date, ahora)) continue;

    // También: si el nuevo y el existente están a menos de 3 años entre sí
    const diffAnios =
      Math.abs(refNueva.getTime() - ref.date.getTime()) / (MS_POR_DIA * 365.25);
    if (diffAnios >= VENTANA_ANIOS) continue;

    const codigoExpediente = resolveCodigoExpediente({
      codigoExpediente: imp.codigoExpediente,
      placa: (row.placa as string | null) ?? "",
    });

    conflictos.push({
      vehiculoId: row.id as string,
      codigoExpediente,
      fechaReferencia: ref.iso,
      marca: (row.marca as string | null) ?? null,
      modelo: (row.modelo as string | null) ?? null,
    });
  }

  if (conflictos.length === 0) {
    return { ok: true, aplicable: true, tipo: "natural" };
  }

  const norma = getNormaByRegla(REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS);
  const primero = conflictos[0]!;
  const codigo = primero.codigoExpediente ?? "expediente previo";
  const vehiculoLabel = [primero.marca, primero.modelo].filter(Boolean).join(" ");

  return {
    ok: false,
    aplicable: true,
    tipo: "natural",
    reglaCodigo: REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS,
    error:
      `${norma?.titulo ?? "Cupo persona natural"}: este RIF ya tiene ` +
      `${conflictos.length} vehículo(s) en menos de 3 años` +
      ` (ej. ${codigo}${vehiculoLabel ? ` · ${vehiculoLabel}` : ""}). ` +
      `No se puede registrar otro hasta cumplir el lapso.`,
    conflictos,
  };
}
