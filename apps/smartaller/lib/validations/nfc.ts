import { z } from "zod";

export const nfcTokenSchema = z
  .string()
  .min(16, "Token inválido")
  .max(64, "Token inválido")
  .regex(/^[A-Za-z0-9_-]+$/, "Token inválido");

export const nfcPinSchema = z
  .string()
  .min(4, "El PIN debe tener al menos 4 dígitos")
  .max(8, "El PIN debe tener máximo 8 dígitos")
  .regex(/^\d+$/, "El PIN solo puede contener números");

export const createNfcStickerSchema = z.object({
  etiqueta: z.string().trim().max(80).optional().nullable(),
  placa: z.string().trim().max(20).optional().nullable(),
  marca: z.string().trim().max(60).optional().nullable(),
  modelo: z.string().trim().max(60).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  nombreTitular: z.string().trim().max(120).optional().nullable(),
  vehiculoId: z.string().uuid().optional().nullable(),
  pin: nfcPinSchema.optional().nullable(),
  notas: z.string().trim().max(500).optional().nullable(),
});

export const updateNfcStickerSchema = z.object({
  id: z.string().uuid(),
  etiqueta: z.string().trim().max(80).optional().nullable(),
  placa: z.string().trim().max(20).optional().nullable(),
  marca: z.string().trim().max(60).optional().nullable(),
  modelo: z.string().trim().max(60).optional().nullable(),
  color: z.string().trim().max(40).optional().nullable(),
  nombreTitular: z.string().trim().max(120).optional().nullable(),
  vehiculoId: z.string().uuid().optional().nullable(),
  pin: nfcPinSchema.optional().nullable(),
  clearPin: z.boolean().optional(),
  activo: z.boolean().optional(),
  notas: z.string().trim().max(500).optional().nullable(),
});

export const verifyNfcSchema = z.object({
  token: nfcTokenSchema,
  pin: nfcPinSchema,
});

export const hashPinBodySchema = z.object({
  pin: nfcPinSchema,
});

export type CreateNfcStickerInput = z.infer<typeof createNfcStickerSchema>;
export type UpdateNfcStickerInput = z.infer<typeof updateNfcStickerSchema>;
