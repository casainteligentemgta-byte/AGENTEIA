import { z } from "zod";

export const SEGURO_FICHA_SELECT =
  "id, created_at, updated_at, taller_id, aseguradora, numero_poliza, tipo_cobertura, vigencia_desde, vigencia_hasta, monto_asegurado, telefono_aseguradora, corredor, observaciones, activo";

export type SeguroFichaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  taller_id: string;
  aseguradora: string;
  numero_poliza: string | null;
  tipo_cobertura: string | null;
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  monto_asegurado: number | null;
  telefono_aseguradora: string | null;
  corredor: string | null;
  observaciones: string | null;
  activo: boolean;
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => {
      const s = (v ?? "").trim();
      return s.length ? s : null;
    });

export const seguroFichaUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  aseguradora: z.string().trim().min(1, "Aseguradora requerida").max(120),
  numeroPoliza: optionalText(80),
  tipoCobertura: optionalText(80),
  vigenciaDesde: optionalText(32),
  vigenciaHasta: optionalText(32),
  montoAsegurado: z.preprocess((v) => {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  }, z.number().nullable()),
  telefonoAseguradora: optionalText(40),
  corredor: optionalText(120),
  observaciones: optionalText(1000),
});

export const asignarFichaSchema = z.object({
  fichaId: z.string().uuid(),
  vehiculoId: z.string().uuid(),
});
