"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { ensureTallerForUser } from "@/lib/taller";
import { extractPlacaFromImage } from "@/lib/extract-placa";
import { extractTableroFromImage } from "@/lib/extract-tablero";
import { formatLlmAuthError } from "@/lib/ai/openai-config";
import { ESTADO_VISUAL_VISTAS } from "@/lib/schemas/estado-visual-recepcion";
import {
  uploadEstadoVisualFoto,
  validateEstadoVisualFile,
  type EstadoVisualFotoRef,
} from "@/lib/ordenes-recepcion/upload-estado-visual";
import { buildFichaVehiculoInspeccion } from "@/lib/ordenes-recepcion/ficha-vehiculo";
import { normalizarPlaca } from "@/lib/vehicles/link";
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
      kilometrajeDetectado?: number | null;
      ficha?: ReturnType<typeof buildFichaVehiculoInspeccion>;
      odometroLabel?: string;
    }
  | { ok: false; error: string };

async function bufferFromFile(file: File): Promise<{ buffer: Buffer; mimeType: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, mimeType: file.type || "image/jpeg" };
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
      ? normalizarPlaca(placaEsperadaRaw)
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

  const validationError = validateEstadoVisualFile(file);
  if (validationError) return { ok: false, error: validationError };

  try {
    const supabase = createAdminClient();
    const { buffer, mimeType } = await bufferFromFile(file);

    const foto = await uploadEstadoVisualFoto(supabase, {
      tallerId: taller.id,
      vista: vista as (typeof ESTADO_VISUAL_VISTAS)[number],
      file,
      vehiculoId,
    });

    const base = { ok: true as const, foto: { ...foto, vista } };

    if (vista === "frontal") {
      const { placa, confianza } = await extractPlacaFromImage(buffer, mimeType);
      if (!placa) {
        return {
          ok: false,
          error: "No se detectó la placa. Acerca la cámara a la matrícula frontal.",
        };
      }

      const placaNorm = normalizarPlaca(placa);

      const { data: vehiculo, error: vehError } = await supabase
        .from("vehiculos")
        .select(
          "id, placa, nombre_cliente, telefono_cliente, marca, modelo, color, serial_carroceria, tipo_vehiculo, kilometraje_ultimo, horas_motor_ultimo"
        )
        .eq("taller_id", taller.id)
        .eq("placa", placaNorm)
        .maybeSingle();

      if (vehError || !vehiculo) {
        return {
          ok: false,
          error: `No encontré el vehículo ${placaNorm} en tu flota. Regístralo primero.`,
        };
      }

      if (vehiculoId && vehiculo.id !== vehiculoId) {
        return {
          ok: false,
          error: `La placa detectada (${placaNorm}) no coincide con el vehículo abierto.`,
        };
      }

      if (placaEsperada && placaNorm !== placaEsperada) {
        return {
          ok: false,
          error: `La placa detectada (${placaNorm}) no coincide con ${placaEsperada}.`,
        };
      }

      const config = getConfigTipoVehiculo((vehiculo.tipo_vehiculo ?? "auto") as TipoVehiculo);
      const odometroLabel =
        config.unidadOdometro === "horas" ? "Horas de motor" : "Kilometraje";

      return {
        ...base,
        placaDetectada: placaNorm,
        placaCoincide: true,
        vehiculoId: vehiculo.id,
        placaVehiculo: vehiculo.placa,
        ficha: buildFichaVehiculoInspeccion(vehiculo),
        odometroLabel,
        ...(confianza === "baja"
          ? {}
          : {}),
      };
    }

    if (vista === "tablero") {
      const tablero = await extractTableroFromImage(buffer, mimeType);
      return {
        ...base,
        kilometrajeDetectado: tablero.kilometraje,
      };
    }

    return base;
  } catch (err) {
    const message = formatLlmAuthError(err);
    return { ok: false, error: message };
  }
}
