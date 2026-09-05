import type { DocumentoTipo } from "@/lib/schemas/vehiculo-documentos";

/**
 * Regímenes de importación de vehículos en Venezuela (SENIAT / INTT).
 * La planilla es la misma; cada régimen añade recaudos y reglas.
 *
 * 5.º = admisión temporal (aduanero; INTT lista 4 de registro + temporal operativo).
 */
export const REGIMENES_IMPORTACION = [
  "ordinario",
  "equipaje",
  "puerto_libre",
  "diplomatico",
  "temporal",
] as const;

export type RegimenImportacion = (typeof REGIMENES_IMPORTACION)[number];

export type RegimenImportacionConfig = {
  codigo: RegimenImportacion;
  label: string;
  shortLabel: string;
  descripcion: string;
  /** Recaudos adicionales en desaduanamiento (además de la carpeta base). */
  docsExtraDesaduanamiento: DocumentoTipo[];
  /** Origen/hint por doc extra. */
  docsExtraOrigen: Partial<Record<DocumentoTipo, string>>;
  /** Wizard M2/M3 solo aplica a Puerto Libre. */
  nacionalizacionPuertoLibre: boolean;
  /** Cupo persona natural 1 vehículo / 3 años. */
  aplicaCupoPersonaNatural: boolean;
};

export const REGIMEN_IMPORTACION_LABELS: Record<RegimenImportacion, string> = {
  ordinario: "Régimen ordinario",
  equipaje: "Régimen de equipaje",
  puerto_libre: "Puerto Libre",
  diplomatico: "Régimen diplomático",
  temporal: "Admisión temporal",
};

export const REGIMENES_IMPORTACION_CONFIG: Record<
  RegimenImportacion,
  RegimenImportacionConfig
> = {
  ordinario: {
    codigo: "ordinario",
    label: "Régimen ordinario",
    shortLabel: "Ordinario",
    descripcion:
      "Importación definitiva por vía común. Pago de tributos y licencia de importación automotriz.",
    docsExtraDesaduanamiento: ["licencia_importacion_automotriz"],
    docsExtraOrigen: {
      licencia_importacion_automotriz: "Licencia de importación automotriz",
    },
    nacionalizacionPuertoLibre: false,
    aplicaCupoPersonaNatural: false,
  },
  equipaje: {
    codigo: "equipaje",
    label: "Régimen de equipaje",
    shortLabel: "Equipaje",
    descripcion:
      "Viajero / retornado con permanencia en el exterior. Exoneraciones SENIAT y cupo 1 vehículo / 3 años.",
    docsExtraDesaduanamiento: [
      "certificado_uso_consular",
      "oficio_exoneracion_seniat",
      "pasaporte_propietario",
      "declaracion_jurada_propietario",
    ],
    docsExtraOrigen: {
      certificado_uso_consular: "Certificado de uso (consulado Venezuela)",
      oficio_exoneracion_seniat: "Oficio de exoneración SENIAT",
      pasaporte_propietario: "Pasaporte del propietario",
      declaracion_jurada_propietario: "Declaración jurada del propietario",
    },
    nacionalizacionPuertoLibre: false,
    aplicaCupoPersonaNatural: true,
  },
  puerto_libre: {
    codigo: "puerto_libre",
    label: "Puerto Libre",
    shortLabel: "P. Libre",
    descripcion:
      "Régimen preferencial de Puerto Libre. Constancia de residencia y vías de nacionalización a 3 años.",
    // constancia_residencia_permanencia va en la base del expediente SENIAT.
    docsExtraDesaduanamiento: [],
    docsExtraOrigen: {},
    nacionalizacionPuertoLibre: true,
    aplicaCupoPersonaNatural: true,
  },
  diplomatico: {
    codigo: "diplomatico",
    label: "Régimen diplomático",
    shortLabel: "Diplomático",
    descripcion:
      "Franquicia y facilidad diplomática (MPPRE) + exoneración SENIAT.",
    docsExtraDesaduanamiento: [
      "oficio_exoneracion_seniat",
      "franquicia_diplomatica",
      "facilidad_diplomatica",
    ],
    docsExtraOrigen: {
      oficio_exoneracion_seniat: "Oficio de exoneración SENIAT",
      franquicia_diplomatica: "Franquicia diplomática (MPPRE)",
      facilidad_diplomatica: "Facilidad diplomática (MPPRE)",
    },
    nacionalizacionPuertoLibre: false,
    aplicaCupoPersonaNatural: false,
  },
  temporal: {
    codigo: "temporal",
    label: "Admisión temporal",
    shortLabel: "Temporal",
    descripcion:
      "Ingreso temporal bajo garantía / autorización aduanera. No equivale a nacionalización definitiva.",
    docsExtraDesaduanamiento: ["autorizacion_admision_temporal"],
    docsExtraOrigen: {
      autorizacion_admision_temporal:
        "Autorización / garantía de admisión temporal",
    },
    nacionalizacionPuertoLibre: false,
    aplicaCupoPersonaNatural: false,
  },
};

const LEGACY_REGIMEN_MAP: Record<string, RegimenImportacion> = {
  "puerto libre": "puerto_libre",
  puerto_libre: "puerto_libre",
  "régimen ordinario": "ordinario",
  "regimen ordinario": "ordinario",
  ordinario: "ordinario",
  "régimen de equipaje": "equipaje",
  "regimen de equipaje": "equipaje",
  equipaje: "equipaje",
  "régimen diplomático": "diplomatico",
  "regimen diplomatico": "diplomatico",
  diplomatico: "diplomatico",
  "admisión temporal": "temporal",
  "admision temporal": "temporal",
  temporal: "temporal",
};

export function isRegimenImportacion(value: unknown): value is RegimenImportacion {
  return (
    typeof value === "string" &&
    (REGIMENES_IMPORTACION as readonly string[]).includes(value)
  );
}

/** Normaliza valor libre / legacy → código de régimen (default Puerto Libre). */
export function resolveRegimenImportacion(
  value: string | null | undefined
): RegimenImportacion {
  if (!value?.trim()) return "puerto_libre";
  const raw = value.trim();
  if (isRegimenImportacion(raw)) return raw;
  const mapped = LEGACY_REGIMEN_MAP[raw.toLowerCase()];
  return mapped ?? "puerto_libre";
}

export function getRegimenConfig(
  value: string | null | undefined
): RegimenImportacionConfig {
  return REGIMENES_IMPORTACION_CONFIG[resolveRegimenImportacion(value)];
}

export function labelRegimenImportacion(
  value: string | null | undefined
): string {
  return getRegimenConfig(value).label;
}

/** Opciones para selects (value = código). */
export const REGIMEN_SELECT_OPTIONS: { value: RegimenImportacion; label: string }[] =
  REGIMENES_IMPORTACION.map((codigo) => ({
    value: codigo,
    label: REGIMEN_IMPORTACION_LABELS[codigo],
  }));

/**
 * Carpeta de desaduanamiento = base + extras del régimen (sin duplicar).
 * `registro_puerto_libre` solo si el importador es persona jurídica.
 * El pase de salida se carga en Pago impuesto (fuera del PDF SENIAT).
 */
export function docsDesaduanamientoPorRegimen(
  regimen: string | null | undefined,
  base: DocumentoTipo[],
  options?: { esJuridica?: boolean }
): DocumentoTipo[] {
  const cfg = getRegimenConfig(regimen);
  const seen = new Set<DocumentoTipo>();
  const out: DocumentoTipo[] = [];
  const esJuridica = options?.esJuridica === true;
  for (const t of [...base, ...cfg.docsExtraDesaduanamiento]) {
    if (t === "registro_puerto_libre" && !esJuridica) continue;
    if (t === "pase_salida_levante") continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Docs del Expediente PDF SENIAT (sin pase de salida). */
export function docsDesaduanamientoPdfPorRegimen(
  regimen: string | null | undefined,
  base: DocumentoTipo[],
  options?: { esJuridica?: boolean }
): DocumentoTipo[] {
  return docsDesaduanamientoPorRegimen(regimen, base, options);
}

export function origenDocDesaduanamiento(
  regimen: string | null | undefined,
  tipo: DocumentoTipo,
  baseOrigen: Partial<Record<DocumentoTipo, string>>
): string | undefined {
  const cfg = getRegimenConfig(regimen);
  return cfg.docsExtraOrigen[tipo] ?? baseOrigen[tipo];
}
