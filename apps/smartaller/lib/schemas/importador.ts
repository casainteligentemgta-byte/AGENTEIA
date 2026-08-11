import { z } from "zod";
import {
  CEDULA_FORMAT_HINT,
  isValidCedula,
  normalizeCedula,
} from "@/lib/validations/cedula";
import { isValidRif, normalizeRif, RIF_FORMAT_HINT } from "@/lib/validations/rif";

export const IMPORTADOR_TIPOS = ["natural", "juridica"] as const;
export type ImportadorTipo = (typeof IMPORTADOR_TIPOS)[number];

export const IMPORTADOR_TIPO_LABELS: Record<ImportadorTipo, string> = {
  natural: "Persona natural",
  juridica: "Persona jurídica",
};

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

const optionalEmail = z
  .string()
  .trim()
  .max(120)
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "Correo inválido",
  });

const rifField = z
  .string()
  .trim()
  .min(1, "Ingresa el RIF")
  .max(40)
  .transform((v) => normalizeRif(v))
  .refine((v) => isValidRif(v), { message: RIF_FORMAT_HINT });

const cedulaField = z
  .string()
  .trim()
  .min(1, "Ingresa la cédula")
  .max(20)
  .transform((v) => normalizeCedula(v))
  .refine((v) => isValidCedula(v), { message: CEDULA_FORMAT_HINT });

const optionalCedulaField = z
  .string()
  .trim()
  .max(20)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? normalizeCedula(v) : ""))
  .refine((v) => !v || isValidCedula(v), { message: CEDULA_FORMAT_HINT });

const importadorNaturalSchema = z
  .object({
    id: z.string().uuid().optional(),
    tipo: z.literal("natural"),
    nombresApellidos: z
      .string()
      .trim()
      .min(2, "Ingresa nombres y apellidos")
      .max(160),
    rif: rifField,
    cedula: cedulaField,
    email: optionalEmail,
    telefono: optionalText(40),
    direccion: optionalText(240),
    instagram: optionalText(80),
    activo: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rif[0] !== "V" && data.rif[0] !== "E") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Persona natural: el RIF debe iniciar con V o E",
        path: ["rif"],
      });
    }
  });

const importadorJuridicaSchema = z
  .object({
    id: z.string().uuid().optional(),
    tipo: z.literal("juridica"),
    denominacionComercial: z
      .string()
      .trim()
      .min(2, "Ingresa la denominación comercial")
      .max(160),
    razonSocial: z.string().trim().min(2, "Ingresa la razón social").max(160),
    rif: rifField,
    repLegalNombre: z
      .string()
      .trim()
      .min(2, "Ingresa nombre y apellidos del representante legal")
      .max(160),
    repLegalCedula: cedulaField,
    repLegalEmail: optionalEmail,
    repLegalTelefono: optionalText(40),
    empresaTelefono: optionalText(40),
    empresaEmail: optionalEmail,
    empresaDomicilio: optionalText(240),
    registroPuertoLibre: z
      .string()
      .trim()
      .min(1, "Ingresa el número de registro de Puerto Libre")
      .max(80),
    registroPlVence: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresa la fecha de vencimiento"),
    activo: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const letra = data.rif[0];
    if (letra !== "J" && letra !== "G" && letra !== "C" && letra !== "P") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Persona jurídica: el RIF debe iniciar con J, G, C o P",
        path: ["rif"],
      });
    }
  });

export const importadorUpsertSchema = z.union([
  importadorNaturalSchema,
  importadorJuridicaSchema,
]);

export type ImportadorUpsertInput = z.infer<typeof importadorUpsertSchema>;

/** Alta mínima desde carga masiva (solo nombre + RIF). */
export const importadorEnsureSchema = z
  .object({
    tipo: z.enum(IMPORTADOR_TIPOS).optional(),
    nombre: z.string().trim().min(2, "Ingresa el nombre o razón social").max(160),
    documento: rifField,
    telefono: optionalText(40),
    email: optionalEmail,
    direccion: optionalText(240),
    cedula: optionalCedulaField,
  })
  .transform((data) => {
    const tipo: ImportadorTipo =
      data.tipo ??
      (data.documento.startsWith("J") ||
      data.documento.startsWith("G") ||
      data.documento.startsWith("C") ||
      data.documento.startsWith("P")
        ? "juridica"
        : "natural");
    return { ...data, tipo };
  });

export type ImportadorRow = {
  id: string;
  taller_id: string;
  tipo: ImportadorTipo;
  nombre: string;
  documento: string;
  cedula: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  instagram: string | null;
  denominacion_comercial: string | null;
  razon_social: string | null;
  rep_legal_nombre: string | null;
  rep_legal_cedula: string | null;
  rep_legal_email: string | null;
  rep_legal_telefono: string | null;
  empresa_telefono: string | null;
  empresa_email: string | null;
  empresa_domicilio: string | null;
  registro_puerto_libre: string | null;
  registro_pl_vence: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
};

export const IMPORTADOR_SELECT =
  "id, taller_id, tipo, nombre, documento, cedula, telefono, email, direccion, instagram, denominacion_comercial, razon_social, rep_legal_nombre, rep_legal_cedula, rep_legal_email, rep_legal_telefono, empresa_telefono, empresa_email, empresa_domicilio, registro_puerto_libre, registro_pl_vence, activo, created_at, updated_at";

/** Nombre visible en listados. */
export function displayNombreImportador(row: {
  tipo: ImportadorTipo;
  nombre: string;
  denominacion_comercial?: string | null;
  razon_social?: string | null;
}): string {
  if (row.tipo === "juridica") {
    return (
      row.denominacion_comercial?.trim() ||
      row.razon_social?.trim() ||
      row.nombre
    );
  }
  return row.nombre;
}

/** Payload DB a partir del upsert validado. */
export function importadorUpsertToDbPayload(
  data: ImportadorUpsertInput,
  tallerId: string
): Record<string, unknown> {
  const base = {
    taller_id: tallerId,
    tipo: data.tipo,
    activo: data.activo ?? true,
    updated_at: new Date().toISOString(),
  };

  if (data.tipo === "natural") {
    return {
      ...base,
      nombre: data.nombresApellidos,
      documento: data.rif,
      cedula: data.cedula,
      telefono: data.telefono?.trim() || null,
      email: data.email?.trim() || null,
      direccion: data.direccion?.trim() || null,
      instagram: data.instagram?.trim() || null,
      denominacion_comercial: null,
      razon_social: null,
      rep_legal_nombre: null,
      rep_legal_cedula: null,
      rep_legal_email: null,
      rep_legal_telefono: null,
      empresa_telefono: null,
      empresa_email: null,
      empresa_domicilio: null,
      registro_puerto_libre: null,
      registro_pl_vence: null,
    };
  }

  return {
    ...base,
    nombre: data.razonSocial,
    documento: data.rif,
    cedula: data.repLegalCedula,
    telefono: data.empresaTelefono?.trim() || null,
    email: data.empresaEmail?.trim() || null,
    direccion: data.empresaDomicilio?.trim() || null,
    instagram: null,
    denominacion_comercial: data.denominacionComercial,
    razon_social: data.razonSocial,
    rep_legal_nombre: data.repLegalNombre,
    rep_legal_cedula: data.repLegalCedula,
    rep_legal_email: data.repLegalEmail?.trim() || null,
    rep_legal_telefono: data.repLegalTelefono?.trim() || null,
    empresa_telefono: data.empresaTelefono?.trim() || null,
    empresa_email: data.empresaEmail?.trim() || null,
    empresa_domicilio: data.empresaDomicilio?.trim() || null,
    registro_puerto_libre: data.registroPuertoLibre,
    registro_pl_vence: data.registroPlVence,
  };
}
