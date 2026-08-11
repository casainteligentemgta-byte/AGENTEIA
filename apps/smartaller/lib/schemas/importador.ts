import { z } from "zod";
import { isValidRif, normalizeRif, RIF_FORMAT_HINT } from "@/lib/validations/rif";

export const IMPORTADOR_TIPOS = ["natural", "juridica"] as const;
export type ImportadorTipo = (typeof IMPORTADOR_TIPOS)[number];

export const IMPORTADOR_TIPO_LABELS: Record<ImportadorTipo, string> = {
  natural: "Persona natural",
  juridica: "Persona jurídica",
};

export const importadorUpsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    tipo: z.enum(IMPORTADOR_TIPOS, {
      errorMap: () => ({ message: "Selecciona si es persona natural o jurídica" }),
    }),
    nombre: z.string().trim().min(2, "Ingresa el nombre o razón social").max(160),
    documento: z
      .string()
      .trim()
      .min(1, "Ingresa el RIF / documento")
      .max(40)
      .transform((v) => normalizeRif(v))
      .refine((v) => isValidRif(v), { message: RIF_FORMAT_HINT }),
    telefono: z.string().trim().max(40).optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .max(120)
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
        message: "Correo inválido",
      }),
    direccion: z.string().trim().max(240).optional().or(z.literal("")),
    activo: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const letra = data.documento[0];
    if (data.tipo === "natural" && letra !== "V" && letra !== "E") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Persona natural: el RIF debe iniciar con V o E",
        path: ["documento"],
      });
    }
    if (
      data.tipo === "juridica" &&
      letra !== "J" &&
      letra !== "G" &&
      letra !== "C" &&
      letra !== "P"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Persona jurídica: el RIF debe iniciar con J, G, C o P",
        path: ["documento"],
      });
    }
  });

export type ImportadorUpsertInput = z.infer<typeof importadorUpsertSchema>;

export type ImportadorRow = {
  id: string;
  taller_id: string;
  tipo: ImportadorTipo;
  nombre: string;
  documento: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string | null;
};
