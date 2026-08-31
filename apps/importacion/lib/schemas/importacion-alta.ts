import { z } from "zod";
import { REGIMENES_IMPORTACION } from "@/lib/importacion/regimenes";
import { isValidRif, normalizeRif, RIF_FORMAT_HINT } from "@/lib/validations/rif";

const currentYear = new Date().getFullYear();

export const TIPOS_COMBUSTIBLE = [
  "gasolina",
  "diesel",
  "electrico",
  "hibrido",
  "gnv",
  "otro",
] as const;

export type TipoCombustible = (typeof TIPOS_COMBUSTIBLE)[number];

export const TIPO_COMBUSTIBLE_LABELS: Record<TipoCombustible, string> = {
  gasolina: "Gasolina",
  diesel: "Diésel",
  electrico: "Eléctrico",
  hibrido: "Híbrido",
  gnv: "GNV / gas",
  otro: "Otro",
};

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const optionalNonNegNumber = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .optional()
  .transform((v) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

/** Fase 1: datos del vehículo + importador + importación. */
export const puertoLibreAltaSchema = z
  .object({
    marca: z.string().trim().min(1, "Ingresa la marca").max(80),
    modelo: z.string().trim().min(1, "Ingresa el modelo").max(80),
    color: z.string().trim().min(1, "Ingresa el color").max(40),
    anio: z.coerce
      .number({ invalid_type_error: "Ingresa el año" })
      .int()
      .min(1950, "Año inválido")
      .max(currentYear + 1, "Año inválido"),
    serialMotor: z.string().trim().min(1, "Ingresa el serial del motor").max(80),
    /** VIN internacional (puede diferir del serial de carrocería SENIAT). */
    vin: z.string().trim().min(1, "Ingresa el VIN").max(32),
    serialCarroceria: z
      .string()
      .trim()
      .min(1, "Ingresa el serial de carrocería")
      .max(80),
    kilometraje: z.coerce
      .number({ invalid_type_error: "Ingresa el kilometraje" })
      .int()
      .min(0, "Kilometraje inválido"),
    condicion: z.enum(["nuevo", "usado"], {
      errorMap: () => ({ message: "Selecciona si el vehículo es nuevo o usado" }),
    }),
    /** Solo aplica si condicion = usado. */
    esSubasta: z
      .union([
        z.boolean(),
        z.literal("true"),
        z.literal("false"),
        z.literal(""),
        z.null(),
        z.undefined(),
      ])
      .transform((v) => {
        if (v === true || v === "true") return true;
        if (v === false || v === "false") return false;
        return null;
      }),
    /** Código arancelario (partida) — SENIAT / aduana. */
    partidaArancelaria: optionalTrimmed(32),
    /** Cilindrada del motor en cc. */
    cilindradaCc: optionalNonNegNumber,
    tipoCombustible: z
      .union([
        z.enum(TIPOS_COMBUSTIBLE),
        z.literal(""),
        z.null(),
        z.undefined(),
      ])
      .optional()
      .transform((v): TipoCombustible | null => {
        if (v == null || v === "") return null;
        return v;
      }),

    /** Fecha de llegada del buque (YYYY-MM-DD). Opcional en carga masiva; se completa al cargar el BL. */
    fechaLlegadaBuque: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
        message: "Ingresa la fecha de llegada del buque (AAAA-MM-DD)",
      }),

    /** Régimen de importación (se confirma en Embarque; default Puerto Libre). */
    regimen: z
      .enum(REGIMENES_IMPORTACION)
      .optional()
      .default("puerto_libre"),

    /**
     * Cliente importador (tabla importadores).
     * Obligatorio en alta individual; en carga masiva se resuelve por documento.
     */
    importadorId: z.string().uuid().optional(),

    /** Snapshot denormalizado (se rellena desde el cliente si viene vacío). */
    importadorNombre: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal("")),
    importadorDocumento: z
      .string()
      .trim()
      .max(40)
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? normalizeRif(v) : ""))
      .refine((v) => !v || isValidRif(v), {
        message: RIF_FORMAT_HINT,
      }),
    importadorTelefono: optionalTrimmed(40),
    importadorEmail: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: "Correo del importador inválido",
      }),
    importadorDireccion: optionalTrimmed(240),

    /** Datos aduaneros opcionales; se pueden completar después en Editar. */
    aduana: optionalTrimmed(120),
    puerto: optionalTrimmed(120),
    modalidadTransito: z
      .enum(["ninguno", "transito", "uso24"])
      .optional()
      .or(z.literal(""))
      .transform((v) => (v === "" || v == null ? null : v)),
    aduanaTransito: optionalTrimmed(120),
    numeroBl: optionalTrimmed(80),
    numeroContenedor: optionalTrimmed(20),
    paisOrigen: optionalTrimmed(80),
    valorCif: optionalNonNegNumber,
    /** Tasa de cambio BCV del día de la declaración (Bs/USD). */
    tasaCambioBcv: optionalNonNegNumber,
    /** Nº de expediente SENIAT (distinto del código interno PL-…). */
    numeroExpedienteSeniat: optionalTrimmed(64),
    numeroDav: optionalTrimmed(80),
    numeroCertificadoOrigen: optionalTrimmed(80),
    numeroListaEmpaque: optionalTrimmed(80),
    numeroPolizaTransporte: optionalTrimmed(80),
    observaciones: optionalTrimmed(1000),
  })
  .superRefine((data, ctx) => {
    if (data.condicion === "usado" && data.esSubasta == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica si el vehículo usado es de subasta",
        path: ["esSubasta"],
      });
    }
    if (data.condicion === "usado" && data.kilometraje <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "En vehículos usados el kilometraje debe ser mayor a 0",
        path: ["kilometraje"],
      });
    }
  });

export type PuertoLibreAltaInput = z.infer<typeof puertoLibreAltaSchema>;

/** Genera el siguiente número de expediente PL-Año.Mes.N para el taller. */
export function placaTemporalDesdeSerial(serialCarroceria: string): string {
  const clean = serialCarroceria.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const suffix = (clean.slice(-10) || Date.now().toString(36).toUpperCase()).slice(
    0,
    10
  );
  return `PL-${suffix}`.slice(0, 20);
}
