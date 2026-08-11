/**
 * Biblioteca legal MVP (módulo Importación / Puerto Libre).
 * Catálogo estático versionado en código; reglas enforceable se enlazan por `reglaCodigo`.
 */

export type NormaLegalEstado = "vigente" | "referencia" | "borrador";

export type NormaLegal = {
  id: string;
  codigo: string;
  titulo: string;
  organismo: string;
  resumen: string;
  /** Qué obliga en la práctica operativa. */
  obliga: string;
  estado: NormaLegalEstado;
  /** Si hay chequeo automático en el sistema. */
  reglaCodigo: string | null;
  etiquetas: string[];
};

export const REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS =
  "persona_natural_max_1_vehiculo_3_anios" as const;

/** Catálogo inicial — ampliar con resoluciones/comunicados SENIAT. */
export const NORMAS_LEGALES: NormaLegal[] = [
  {
    id: "pl-persona-natural-cupo",
    codigo: "PL-CUP-PN-01",
    titulo: "Cupo de importación para persona natural",
    organismo: "Régimen Puerto Libre / SENIAT",
    resumen:
      "Una persona natural no puede importar más de un vehículo en un lapso menor a tres (3) años bajo el régimen aplicable.",
    obliga:
      "Al registrar un expediente con RIF de persona natural (V/E), el sistema verifica que no exista otro vehículo del mismo importador en los últimos 3 años en el taller.",
    estado: "vigente",
    reglaCodigo: REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS,
    etiquetas: ["persona natural", "cupo", "3 años", "alta"],
  },
  {
    id: "pl-desaduanamiento-recaudos",
    codigo: "PL-DES-01",
    titulo: "Recaudos para desaduanamiento SENIAT",
    organismo: "SENIAT / Agente de Aduanas",
    resumen:
      "El desaduanamiento en la circunscripción se canaliza mediante Agente de Aduanas autorizado, presentando B/L, factura, certificado de origen, DUA, DAV, declaración jurada de origen de fondos y planilla de liquidación.",
    obliga:
      "Fase Desaduanamiento de la planilla: carpeta completa + agente. PDF de carpeta física disponible para impresión.",
    estado: "vigente",
    reglaCodigo: "desaduanamiento_carpeta_completa",
    etiquetas: ["desaduanamiento", "SENIAT", "documentos"],
  },
  {
    id: "pl-permanencia-3-anios",
    codigo: "PL-NAC-01",
    titulo: "Permanencia de 3 años y vías de nacionalización",
    organismo: "Régimen Puerto Libre",
    resumen:
      "La permanencia en el régimen y el cambio a libre circulación se rigen por el lapso de tres (3) años desde el ingreso, con vías de cambio de régimen o liberación por permanencia.",
    obliga:
      "Al completar matrícula se calcula fecha límite (ingreso + 3 años). El wizard de nacionalización sugiere la vía según años transcurridos.",
    estado: "vigente",
    reglaCodigo: "nacionalizacion_permanencia_3_anios",
    etiquetas: ["nacionalización", "permanencia", "3 años"],
  },
  {
    id: "pl-ley-puerto-libre",
    codigo: "PL-REF-01",
    titulo: "Ley del Puerto Libre (referencia)",
    organismo: "Marco legal Venezuela",
    resumen:
      "Marco general del régimen preferencial de Puerto Libre. Esta ficha es de consulta operativa; el detalle normativo se ampliará con textos oficiales y resoluciones.",
    obliga:
      "Consultar antes de excepciones. No bloquea altas por sí sola en este MVP.",
    estado: "referencia",
    reglaCodigo: null,
    etiquetas: ["ley", "referencia", "Puerto Libre"],
  },
  {
    id: "ve-regimenes-importacion",
    codigo: "VE-REG-01",
    titulo: "Cinco regímenes de importación vehicular",
    organismo: "SENIAT / INTT",
    resumen:
      "Ordinario, Equipaje, Puerto Libre, Diplomático y Admisión temporal. La planilla es única; cada régimen añade recaudos y reglas (cupo, nacionalización PL, etc.).",
    obliga:
      "Seleccionar régimen al alta. Desaduanamiento exige carpeta base + documentos del régimen.",
    estado: "vigente",
    reglaCodigo: "regimenes_importacion_variantes",
    etiquetas: ["régimen", "ordinario", "equipaje", "diplomático", "temporal"],
  },
];

export function getNormaByRegla(reglaCodigo: string): NormaLegal | undefined {
  return NORMAS_LEGALES.find((n) => n.reglaCodigo === reglaCodigo);
}

export function listNormasLegales(): NormaLegal[] {
  return NORMAS_LEGALES;
}
