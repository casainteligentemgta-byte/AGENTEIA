import { z } from "zod";

/** Vistas del estado visual + tablero encendido */
export const ESTADO_VISUAL_VISTAS = [
  "frontal",
  "trasero",
  "lateral_izquierdo",
  "lateral_derecho",
  "tablero",
] as const;

export type EstadoVisualVista = (typeof ESTADO_VISUAL_VISTAS)[number];

export const ESTADO_VISUAL_VISTA_LABELS: Record<EstadoVisualVista, string> = {
  frontal: "Frontal",
  trasero: "Trasero",
  lateral_izquierdo: "Lateral izquierdo",
  lateral_derecho: "Lateral derecho",
  tablero: "Tablero (motor encendido)",
};

const puntoSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const trazoAnotacionSchema = z.object({
  color: z.string().default("#ef4444"),
  width: z.number().min(1).max(20).default(4),
  points: z.array(puntoSchema).min(1),
});

export const fotoEstadoVisualSchema = z.object({
  vista: z.enum(ESTADO_VISUAL_VISTAS),
  url: z.string().url().optional(),
  path: z.string().optional(),
  trazos: z.array(trazoAnotacionSchema).default([]),
});

export const estadoVisualRecepcionSchema = z.object({
  fotos: z.array(fotoEstadoVisualSchema).default([]),
});

export type TrazoAnotacion = z.infer<typeof trazoAnotacionSchema>;
export type FotoEstadoVisual = z.infer<typeof fotoEstadoVisualSchema>;
export type EstadoVisualRecepcion = z.infer<typeof estadoVisualRecepcionSchema>;

export function parseEstadoVisualRecepcion(raw: unknown): EstadoVisualRecepcion | null {
  const parsed = estadoVisualRecepcionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function tieneEstadoVisual(raw: unknown): boolean {
  const ev = parseEstadoVisualRecepcion(raw);
  if (!ev) return false;
  return ev.fotos.some((f) => f.url || f.trazos.length > 0);
}

export function emptyEstadoVisualSlots(): FotoEstadoVisual[] {
  return ESTADO_VISUAL_VISTAS.map((vista) => ({ vista, trazos: [] }));
}
