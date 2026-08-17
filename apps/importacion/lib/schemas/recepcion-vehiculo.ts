import { z } from "zod";

export const ESTADO_RECEPCION = ["bueno", "regular", "malo", "na"] as const;
export type EstadoRecepcion = (typeof ESTADO_RECEPCION)[number];

export const NIVEL_COMBUSTIBLE = ["vacio", "1_4", "1_2", "3_4", "lleno"] as const;
export type NivelCombustible = (typeof NIVEL_COMBUSTIBLE)[number];

export const ESTADO_RECEPCION_LABELS: Record<EstadoRecepcion, string> = {
  bueno: "Bueno",
  regular: "Regular",
  malo: "Malo",
  na: "N/A",
};

export const NIVEL_COMBUSTIBLE_LABELS: Record<NivelCombustible, string> = {
  vacio: "Vacío",
  "1_4": "1/4",
  "1_2": "1/2",
  "3_4": "3/4",
  lleno: "Lleno",
};

/** Ítems de inventario entregado con el vehículo */
export const INVENTARIO_RECEPCION_ITEMS = [
  { id: "llanta_repuesto", label: "Llanta de repuesto" },
  { id: "gato", label: "Gato / elevador" },
  { id: "llave_pernos", label: "Llave de pernos" },
  { id: "herramientas", label: "Herramientas" },
  { id: "radio", label: "Radio / pantalla" },
  { id: "antena", label: "Antena" },
  { id: "tapetes", label: "Tapetes" },
  { id: "extintor", label: "Extintor" },
  { id: "tapa_combustible", label: "Tapa de combustible" },
] as const;

/** Zonas exteriores del vehículo */
export const ZONAS_EXTERIOR = [
  { id: "frontal", label: "Frontal / capó" },
  { id: "lateral_izq", label: "Lateral izquierdo" },
  { id: "lateral_der", label: "Lateral derecho" },
  { id: "trasera", label: "Trasera / maletero" },
  { id: "techo", label: "Techo" },
  { id: "parabrisas", label: "Parabrisas" },
  { id: "vidrios_laterales", label: "Vidrios laterales" },
  { id: "espejos", label: "Espejos" },
] as const;

/** Sistemas y fluidos */
export const SISTEMAS_RECEPCION = [
  { id: "luces_delanteras", label: "Luces delanteras" },
  { id: "luces_traseras", label: "Luces traseras / stop" },
  { id: "direccionales", label: "Direccionales" },
  { id: "llantas", label: "Estado de llantas" },
  { id: "frenos_visual", label: "Frenos (inspección visual)" },
  { id: "aceite_motor", label: "Nivel aceite motor" },
  { id: "refrigerante", label: "Refrigerante" },
  { id: "liquido_frenos", label: "Líquido de frenos" },
  { id: "limpiaparabrisas", label: "Limpiaparabrisas" },
  { id: "tablero_alertas", label: "Tablero / testigos encendidos" },
  { id: "aire_acondicionado", label: "Aire acondicionado" },
  { id: "asientos_interior", label: "Asientos / interior" },
] as const;

const estadoField = z.enum(ESTADO_RECEPCION).default("na");
const inventarioField = z.record(z.string(), z.boolean()).default({});

export const recepcionVehiculoSchema = z.object({
  fechaIngreso: z.string().trim().optional().or(z.literal("")),
  horaIngreso: z.string().trim().optional().or(z.literal("")),
  kilometrajeIngreso: z.coerce.number().int().min(0).nullable().optional(),
  nivelCombustible: z.enum(NIVEL_COMBUSTIBLE).optional(),
  motivoIngreso: z.string().trim().max(500).optional().or(z.literal("")),
  inventario: inventarioField,
  exterior: z.record(z.string(), estadoField).default({}),
  sistemas: z.record(z.string(), estadoField).default({}),
  danosPreexistentes: z.string().trim().max(2000).optional().or(z.literal("")),
  objetosValor: z.string().trim().max(500).optional().or(z.literal("")),
  autorizaDiagnostico: z.boolean().default(true),
  firmaCliente: z.string().trim().max(120).optional().or(z.literal("")),
});

export type RecepcionVehiculo = z.infer<typeof recepcionVehiculoSchema>;

export function parseRecepcionVehiculo(raw: unknown): RecepcionVehiculo | null {
  const parsed = recepcionVehiculoSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function tieneDatosRecepcion(raw: unknown): boolean {
  const r = parseRecepcionVehiculo(raw);
  if (!r) return false;

  return Boolean(
    r.motivoIngreso?.trim() ||
      r.danosPreexistentes?.trim() ||
      r.objetosValor?.trim() ||
      r.firmaCliente?.trim() ||
      r.kilometrajeIngreso != null ||
      r.nivelCombustible ||
      Object.values(r.inventario ?? {}).some(Boolean) ||
      Object.values(r.exterior ?? {}).some((v) => v && v !== "na") ||
      Object.values(r.sistemas ?? {}).some((v) => v && v !== "na")
  );
}
