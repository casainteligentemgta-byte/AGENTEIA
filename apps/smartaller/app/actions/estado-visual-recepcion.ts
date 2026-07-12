"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { extractTableroFromImage } from "@/lib/extract-tablero";
import { formatLlmAuthError } from "@/lib/ai/openai-config";
import { resolverVehiculoDesdeFotoFrontal } from "@/lib/ordenes-recepcion/resolver-vehiculo-placa";
import { ESTADO_VISUAL_VISTAS } from "@/lib/schemas/estado-visual-recepcion";
import {
  uploadEstadoVisualFotoBuffer,
  type EstadoVisualFotoRef,
} from "@/lib/ordenes-recepcion/upload-estado-visual";
import { buildFichaVehiculoInspeccion } from "@/lib/ordenes-recepcion/ficha-vehiculo";
import { compactarPlaca } from "@/lib/vehicles/placa";
import { resolveImageMimeType } from "@/lib/mime-image";
import { getConfigTipoVehiculo } from "@/lib/vehicles/templates";
import type { TipoVehiculo } from "@/lib/vehicles/types";

export type ProcesarFotoPasoInspeccionResult =
  | {
      ok: true;
      foto: EstadoVisualFotoRef & { vista: string };
      placaDetectada?: string;
      placaCoincide?: boolean;
      vehiculoId?: string;
      placaVehiculo?: string;
      avisoPlaca?: string;
      kilometrajeDetectado?: number | null;
      ficha?: ReturnType<typeof buildFichaVehiculoInspeccion>;
      odometroLabel?: string;
      avisoTablero?: string;
    }
  | { ok: false; error: string; placaDetectada?: string };

async function bufferFromFile(file: File): Promise<{ buffer: Buffer; mimeType: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType =
    resolveImageMimeType({
      declaredMime: file.type,
      fileName: file.name,
      buffer,
    }) ?? "image/jpeg";
  return { buffer, mimeType };
}

export async function uploadEstadoVisualFotoAction(
  formData: FormData
): Promise<{ ok: true; foto: EstadoVisualFotoRef & { vista: string } } | { ok: false; error: string }> {
  const result = await procesarFotoPasoInspeccionAction(formData);
  if (!result.ok) return result;
  return { ok: true, foto: result.foto };
}

export async function procesarFotoPasoInspeccionAction(
  formData: FormData
): Promise<ProcesarFotoPasoInspeccionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { taller } = await ensureTallerForUser(user.id);
  if (!taller) return { ok: false, error: "No se encontró tu taller" };

  const vista = formData.get("vista");
  const file = formData.get("file");
  const vehiculoIdRaw = formData.get("vehiculoId");
  const placaEsperadaRaw = formData.get("placaEsperada");

  const vehiculoId =
    typeof vehiculoIdRaw === "string" && vehiculoIdRaw.length > 0 ? vehiculoIdRaw : undefined;
  const placaEsperada =
    typeof placaEsperadaRaw === "string" && placaEsperadaRaw.length > 0
      ? compactarPlaca(placaEsperadaRaw)
      : undefined;

  if (
    typeof vista !== "string" ||
    !ESTADO_VISUAL_VISTAS.includes(vista as (typeof ESTADO_VISUAL_VISTAS)[number])
  ) {
    return { ok: false, error: "Vista inválida" };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Selecciona una foto" };
  }
  if (file.size === 0) {
    return { ok: false, error: "Archivo vacío" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "La foto supera 10 MB" };
  }

  try {
    const supabase = createAdminClient();
    const { buffer, mimeType } = await bufferFromFile(file);

    const foto = await uploadEstadoVisualFotoBuffer(supabase, {
      tallerId: taller.id,
      vista: vista as (typeof ESTADO_VISUAL_VISTAS)[number],
      buffer,
      mimeType,
      fileName: file.name,
      vehiculoId,
    });

    const base = { ok: true as const, foto: { ...foto, vista } };

    if (vista === "frontal") {
      const resolucion = await resolverVehiculoDesdeFotoFrontal(supabase, {
        tallerId: taller.id,
        imageBuffer: buffer,
        mimeType,
        vehiculoId,
        placaEsperada,
      });

      if (!resolucion.ok) {
        return {
          ok: false,
          error: resolucion.error,
          placaDetectada: resolucion.placaDetectada,
        };
      }

      const { vehiculo, placaDetectada, placaCoincide, aviso } = resolucion;
      const config = getConfigTipoVehiculo((vehiculo.tipo_vehiculo ?? "auto") as TipoVehiculo);
      const odometroLabel =
        config.unidadOdometro === "horas" ? "Horas de motor" : "Kilometraje";

      return {
        ...base,
        placaDetectada: placaDetectada ?? compactarPlaca(vehiculo.placa),
        placaCoincide,
        vehiculoId: vehiculo.id,
        placaVehiculo: vehiculo.placa,
        ficha: buildFichaVehiculoInspeccion(vehiculo),
        odometroLabel,
        avisoPlaca: aviso,
      };
    }

    if (vista === "tablero") {
      try {
        const tablero = await extractTableroFromImage(buffer, mimeType);
        return {
          ...base,
          kilometrajeDetectado: tablero.kilometraje,
        };
      } catch (ocrError) {
        return {
          ...base,
          kilometrajeDetectado: null,
          avisoTablero: formatLlmAuthError(ocrError),
        };
      }
    }

    return base;
  } catch (err) {
    const message = formatLlmAuthError(err);
    return { ok: false, error: message };
  }
}
