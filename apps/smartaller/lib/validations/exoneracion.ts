import { z } from "zod";
import { TIPOS_EXONERACION } from "@/lib/billing/plans";

export const crearExoneracionSchema = z
  .object({
    tipo: z.enum(TIPOS_EXONERACION),
    email: z.string().trim().email("Correo inválido").optional(),
    tallerId: z.string().uuid().optional(),
    vigenteHasta: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
      .optional()
      .or(z.literal("")),
    notas: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.tipo === "perfil" && !value.email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Indica el correo del cliente",
        path: ["email"],
      });
    }
    if (
      (value.tipo === "taller" || value.tipo === "taller_clientes") &&
      !value.tallerId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona el taller",
        path: ["tallerId"],
      });
    }
  });

export const revocarExoneracionSchema = z.object({
  exoneracionId: z.string().uuid(),
});
