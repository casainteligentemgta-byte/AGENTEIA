import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPlacaFromImage } from "@/lib/extract-placa";
import {
  compactarPlaca,
  placasCoinciden,
  resolverPlacaEnFlota,
} from "@/lib/vehicles/placa";

export type VehiculoInspeccionRow = {
  id: string;
  placa: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  serial_carroceria: string | null;
  tipo_vehiculo: string | null;
  kilometraje_ultimo: number | null;
  horas_motor_ultimo: number | null;
};

const VEHICULO_SELECT =
  "id, placa, nombre_cliente, telefono_cliente, marca, modelo, color, serial_carroceria, tipo_vehiculo, kilometraje_ultimo, horas_motor_ultimo";

export type ResolverVehiculoFrontalResult =
  | {
      ok: true;
      vehiculo: VehiculoInspeccionRow;
      placaDetectada: string | null;
      placaCoincide: boolean;
      aviso?: string;
    }
  | { ok: false; error: string; placaDetectada?: string };

export async function resolverVehiculoDesdeFotoFrontal(
  supabase: SupabaseClient,
  params: {
    tallerId: string;
    imageBuffer: Buffer;
    mimeType: string;
    vehiculoId?: string;
    placaEsperada?: string;
  }
): Promise<ResolverVehiculoFrontalResult> {
  const { tallerId, imageBuffer, mimeType, vehiculoId, placaEsperada } = params;

  if (vehiculoId) {
    const { data: vehiculo, error } = await supabase
      .from("vehiculos")
      .select(VEHICULO_SELECT)
      .eq("taller_id", tallerId)
      .eq("id", vehiculoId)
      .maybeSingle();

    if (error || !vehiculo) {
      return { ok: false, error: "No se encontró el vehículo abierto en tu taller." };
    }

    let placaDetectada: string | null = null;
    let placaCoincide = true;
    let aviso: string | undefined;

    try {
      const ocr = await extractPlacaFromImage(imageBuffer, mimeType, "frontal");
      placaDetectada = ocr.placa;
      if (placaDetectada) {
        placaCoincide = placasCoinciden(placaDetectada, vehiculo.placa);
        if (!placaCoincide) {
          aviso = `La cámara leyó ${placaDetectada}, pero se usará la ficha ${vehiculo.placa}.`;
        }
      }
    } catch {
      aviso = "No se pudo leer la placa en la foto; se usa la ficha del vehículo.";
    }

    if (placaEsperada && !placasCoinciden(vehiculo.placa, placaEsperada)) {
      return { ok: false, error: "El vehículo abierto no coincide con la placa esperada." };
    }

    return {
      ok: true,
      vehiculo: vehiculo as VehiculoInspeccionRow,
      placaDetectada,
      placaCoincide,
      aviso,
    };
  }

  const ocr = await extractPlacaFromImage(imageBuffer, mimeType, "frontal");
  if (!ocr.placa) {
    return {
      ok: false,
      error:
        "No se detectó la placa. Enfoca el parachoques o portaplacas frontal; evita logos y stickers.",
    };
  }

  const placaDetectada = compactarPlaca(ocr.placa);

  const { data: flota, error: flotaError } = await supabase
    .from("vehiculos")
    .select(VEHICULO_SELECT)
    .eq("taller_id", tallerId);

  if (flotaError || !flota?.length) {
    return {
      ok: false,
      error: `No encontré el vehículo ${placaDetectada} en tu flota. Regístralo primero.`,
      placaDetectada,
    };
  }

  const coincidencia = resolverPlacaEnFlota(
    placaDetectada,
    flota.map((v) => v.placa)
  );

  if (!coincidencia) {
    const sugerencia =
      ocr.placaAlternativa && ocr.placaAlternativa !== placaDetectada
        ? ` También se leyó ${ocr.placaAlternativa}.`
        : "";
    return {
      ok: false,
      error: `No encontré el vehículo ${placaDetectada} en tu flota.${sugerencia} Regístralo o vuelve a tomar la foto más cerca de la placa.`,
      placaDetectada,
    };
  }

  const vehiculo = flota.find((v) => compactarPlaca(v.placa) === coincidencia.placa);
  if (!vehiculo) {
    return {
      ok: false,
      error: `No encontré el vehículo ${placaDetectada} en tu flota. Regístralo primero.`,
      placaDetectada,
    };
  }

  if (placaEsperada && !placasCoinciden(vehiculo.placa, placaEsperada)) {
    return {
      ok: false,
      error: `La placa detectada (${placaDetectada}) no coincide con ${compactarPlaca(placaEsperada)}.`,
      placaDetectada,
    };
  }

  const placaCoincide = coincidencia.metodo === "exacta";
  const aviso =
    coincidencia.metodo !== "exacta"
      ? `Placa leída ${placaDetectada} → coincidió con ${vehiculo.placa} (${coincidencia.metodo}).`
      : ocr.confianza === "baja"
        ? `Placa leída con baja confianza: ${placaDetectada}. Verifica que sea correcta.`
        : undefined;

  return {
    ok: true,
    vehiculo: vehiculo as VehiculoInspeccionRow,
    placaDetectada,
    placaCoincide,
    aviso,
  };
}
