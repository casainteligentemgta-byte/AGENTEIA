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

/** URL flexible: acepta public URLs de Storage (sin tumbar el parse completo). */
const fotoUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}, z.string().min(1).optional());

export const fotoEstadoVisualSchema = z.object({
  vista: z.enum(ESTADO_VISUAL_VISTAS),
  url: fotoUrlSchema,
  path: z.string().optional(),
  trazos: z.array(trazoAnotacionSchema).default([]),
});

export const estadoVisualRecepcionSchema = z.object({
  fotos: z.array(fotoEstadoVisualSchema).default([]),
});

export type TrazoAnotacion = z.infer<typeof trazoAnotacionSchema>;
export type FotoEstadoVisual = z.infer<typeof fotoEstadoVisualSchema>;
export type EstadoVisualRecepcion = z.infer<typeof estadoVisualRecepcionSchema>;

function parseFotoLoose(raw: unknown): FotoEstadoVisual | null {
  const strict = fotoEstadoVisualSchema.safeParse(raw);
  if (strict.success) {
    return {
      ...strict.data,
      url: strict.data.url || undefined,
      trazos: strict.data.trazos ?? [],
    };
  }

  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const vista = row.vista;
  if (typeof vista !== "string" || !ESTADO_VISUAL_VISTAS.includes(vista as EstadoVisualVista)) {
    return null;
  }

  const url =
    typeof row.url === "string" && row.url.trim().length > 0 ? row.url.trim() : undefined;
  const path =
    typeof row.path === "string" && row.path.trim().length > 0 ? row.path.trim() : undefined;

  const trazosParsed = z.array(trazoAnotacionSchema).safeParse(row.trazos ?? []);
  return {
    vista: vista as EstadoVisualVista,
    url,
    path,
    trazos: trazosParsed.success ? trazosParsed.data : [],
  };
}

export function parseEstadoVisualRecepcion(raw: unknown): EstadoVisualRecepcion | null {
  if (!raw || typeof raw !== "object") return null;
  const fotosRaw = (raw as { fotos?: unknown }).fotos;
  if (!Array.isArray(fotosRaw)) {
    const strict = estadoVisualRecepcionSchema.safeParse(raw);
    return strict.success ? strict.data : null;
  }

  const fotos = fotosRaw
    .map(parseFotoLoose)
    .filter((f): f is FotoEstadoVisual => f != null);

  return { fotos };
}

export function tieneEstadoVisual(raw: unknown): boolean {
  const ev = parseEstadoVisualRecepcion(raw);
  if (!ev) return false;
  return ev.fotos.some((f) => f.url || f.path || f.trazos.length > 0);
}

export function emptyEstadoVisualSlots(): FotoEstadoVisual[] {
  return ESTADO_VISUAL_VISTAS.map((vista) => ({ vista, trazos: [] }));
}

/** Asegura las 5 vistas y aplica un patch sobre una (upsert). Evita perder laterales/trasera. */
export function upsertEstadoVisualFoto(
  fotos: FotoEstadoVisual[] | undefined,
  vista: EstadoVisualVista,
  patch: Partial<FotoEstadoVisual>
): FotoEstadoVisual[] {
  const byVista = new Map<EstadoVisualVista, FotoEstadoVisual>();
  for (const slot of emptyEstadoVisualSlots()) {
    byVista.set(slot.vista, slot);
  }
  for (const foto of fotos ?? []) {
    if (ESTADO_VISUAL_VISTAS.includes(foto.vista)) {
      byVista.set(foto.vista, { ...byVista.get(foto.vista)!, ...foto });
    }
  }
  const current = byVista.get(vista) ?? { vista, trazos: [] };
  byVista.set(vista, { ...current, ...patch, vista });
  return ESTADO_VISUAL_VISTAS.map((v) => byVista.get(v)!);
}

export function estadoVisualConFrontalPrefill(frontal: {
  url: string;
  path: string;
}): EstadoVisualRecepcion {
  return {
    fotos: emptyEstadoVisualSlots().map((foto) =>
      foto.vista === "frontal"
        ? { ...foto, url: frontal.url, path: frontal.path, trazos: [] }
        : foto
    ),
  };
}

/** Reconstruye URL pública de Storage si falta `url` pero hay `path`. */
export function ensureEstadoVisualFotoUrls(
  estado: EstadoVisualRecepcion | null,
  supabaseUrl: string | null | undefined
): EstadoVisualRecepcion | null {
  if (!estado) return null;
  const base = supabaseUrl?.replace(/\/$/, "");
  if (!base) return estado;

  return {
    fotos: estado.fotos.map((foto) => {
      if (foto.url || !foto.path) return foto;
      return {
        ...foto,
        url: `${base}/storage/v1/object/public/recepcion-estado-visual/${foto.path}`,
      };
    }),
  };
}
