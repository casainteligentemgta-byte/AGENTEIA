import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getDescripcion, normalizePlaca } from "@/lib/format";

export const CLIENTE_ERROR_GENERICO =
  "No pudimos verificar esos datos. Revisa la placa y los últimos 4 dígitos del teléfono.";

export const CLIENTE_ERROR_RATE_LIMIT =
  "Demasiados intentos. Espera un momento e inténtalo de nuevo.";

export const CLIENTE_RATE_WINDOW_MS = 15 * 60 * 1000;
export const CLIENTE_RATE_MAX = 8;

export const clienteBusquedaSchema = z.object({
  placa: z
    .string()
    .min(4, "Ingresa la placa del vehículo")
    .max(10)
    .transform((v) => normalizePlaca(v).replace(/[^A-Z0-9]/g, "")),
  telefonoUltimos4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Ingresa los últimos 4 dígitos del teléfono"),
});

export type ClienteBusquedaInput = z.infer<typeof clienteBusquedaSchema>;

export type ClienteHistorialPublico = {
  placa: string;
  nombre_cliente: string | null;
  kilometraje_ultimo: number | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  mantenimientos: Array<{
    id: string;
    created_at: string;
    descripcion: string | null;
    costo: number | null;
    kilometraje: number | null;
  }>;
  recordatorios: Array<{
    id: string;
    fecha_programada: string;
    kilometraje_objetivo: number | null;
  }>;
};

export type VehiculoLookupRow = {
  id: string;
  placa: string;
  nombre_cliente: string | null;
  telefono_cliente: string | null;
  kilometraje_ultimo: number | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
};

function fourDigitBuffer(value: string): Buffer {
  const padded = value.padEnd(4, "\0").slice(0, 4);
  return Buffer.from(padded);
}

/** Comparación de 4 dígitos a tiempo constante (mismo largo siempre). */
export function telefonoUltimos4Igual(
  telefono: string | null | undefined,
  ultimos4: string
): boolean {
  const digits = (telefono ?? "").replace(/\D/g, "");
  const suffix = digits.length >= 4 ? digits.slice(-4) : "\0\0\0\0";
  const match = timingSafeEqual(fourDigitBuffer(suffix), fourDigitBuffer(ultimos4));
  return Boolean(telefono) && digits.length >= 4 && match;
}

export function proyectarHistorialCliente(
  vehiculo: VehiculoLookupRow,
  mantenimientos: Array<{
    id: string;
    created_at: string;
    descripcion?: string | null;
    descripcion_servicio?: string | null;
    costo: number | null;
    kilometraje: number | null;
  }>,
  recordatorios: Array<{
    id: string;
    fecha_programada: string;
    kilometraje_objetivo: number | null;
  }>
): ClienteHistorialPublico {
  return {
    placa: vehiculo.placa,
    nombre_cliente: vehiculo.nombre_cliente,
    kilometraje_ultimo: vehiculo.kilometraje_ultimo,
    marca: vehiculo.marca,
    modelo: vehiculo.modelo,
    color: vehiculo.color,
    mantenimientos: mantenimientos.map((m) => ({
      id: m.id,
      created_at: m.created_at,
      descripcion: getDescripcion({
        descripcion: m.descripcion ?? null,
        descripcion_servicio: m.descripcion_servicio,
      }),
      costo: m.costo,
      kilometraje: m.kilometraje,
    })),
    recordatorios: recordatorios.map((r) => ({
      id: r.id,
      fecha_programada: r.fecha_programada,
      kilometraje_objetivo: r.kilometraje_objetivo,
    })),
  };
}
