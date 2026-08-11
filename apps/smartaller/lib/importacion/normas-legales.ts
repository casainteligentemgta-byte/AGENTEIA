/**
 * Biblioteca legal — módulo Importación / Puerto Libre.
 * Catálogo estático versionado: leyes, reglamentos, códigos y procedimientos.
 * La app actúa como garante/vigilante vía `reglaCodigo`, `ilicitos` y `lapsos`.
 */

export type NormaLegalEstado = "vigente" | "referencia" | "borrador";

export type NormaLegalTipo =
  | "ley"
  | "reglamento"
  | "codigo"
  | "resolucion"
  | "procedimiento";

/** Fase operativa del expediente a la que aplica la norma. */
export type NormaProcesoAduana =
  | "alta"
  | "embarque"
  | "llegada"
  | "desaduanamiento"
  | "nacionalizacion"
  | "matriculacion"
  | "seguro"
  | "transversal";

export type NormaIlicito = {
  /** Código corto interno (p. ej. ILC-01). */
  codigo: string;
  /** Qué se considera irregular / ilícito administrativo o de procedimiento. */
  descripcion: string;
  /** Cómo lo detecta o alerta el sistema hoy (o “consulta”). */
  vigilancia: string;
};

export type NormaLapso = {
  /** Nombre del plazo. */
  nombre: string;
  /** Duración de referencia (texto operativo). */
  duracion: string;
  /** Días antes del vencimiento en que el sistema alerta (si aplica). */
  alertaDiasAntes: number | null;
  /** Código de alerta en cron / UI, si existe. */
  alertaCodigo: string | null;
};

export type NormaLegal = {
  id: string;
  codigo: string;
  titulo: string;
  tipo: NormaLegalTipo;
  organismo: string;
  proceso: NormaProcesoAduana;
  resumen: string;
  /** Qué obliga en la práctica operativa. */
  obliga: string;
  estado: NormaLegalEstado;
  /** Si hay chequeo automático en el sistema. */
  reglaCodigo: string | null;
  ilicitos: NormaIlicito[];
  lapsos: NormaLapso[];
  etiquetas: string[];
};

export const REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS =
  "persona_natural_max_1_vehiculo_3_anios" as const;

export const NORMA_TIPO_LABELS: Record<NormaLegalTipo, string> = {
  ley: "Ley",
  reglamento: "Reglamento",
  codigo: "Código / norma",
  resolucion: "Resolución",
  procedimiento: "Procedimiento",
};

export const NORMA_PROCESO_LABELS: Record<NormaProcesoAduana, string> = {
  alta: "Alta / registro",
  embarque: "Embarque",
  llegada: "Llegada",
  desaduanamiento: "Desaduanamiento",
  nacionalizacion: "Nacionalización",
  matriculacion: "Matriculación",
  seguro: "Seguro",
  transversal: "Transversal",
};

/** Catálogo — ampliar con textos oficiales SENIAT / Gaceta. */
export const NORMAS_LEGALES: NormaLegal[] = [
  {
    id: "pl-persona-natural-cupo",
    codigo: "PL-CUP-PN-01",
    titulo: "Cupo de importación para persona natural",
    tipo: "procedimiento",
    organismo: "Régimen Puerto Libre / SENIAT",
    proceso: "alta",
    resumen:
      "Una persona natural no puede importar más de un vehículo en un lapso menor a tres (3) años bajo el régimen aplicable.",
    obliga:
      "Al registrar un expediente con RIF de persona natural (V/E), el sistema verifica que no exista otro vehículo del mismo importador en los últimos 3 años en el taller.",
    estado: "vigente",
    reglaCodigo: REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS,
    ilicitos: [
      {
        codigo: "ILC-CUP-01",
        descripcion:
          "Registrar un segundo vehículo a nombre de la misma persona natural dentro del lapso de 3 años.",
        vigilancia:
          "Bloqueo automático al alta y en carga masiva (RIF V/E).",
      },
    ],
    lapsos: [
      {
        nombre: "Ventana de cupo entre importaciones",
        duracion: "3 años entre fechas de referencia",
        alertaDiasAntes: null,
        alertaCodigo: REGLA_PERSONA_NATURAL_MAX_1_VEHICULO_3_ANIOS,
      },
    ],
    etiquetas: ["persona natural", "cupo", "3 años", "alta"],
  },
  {
    id: "pl-desaduanamiento-recaudos",
    codigo: "PL-DES-01",
    titulo: "Recaudos para desaduanamiento SENIAT",
    tipo: "procedimiento",
    organismo: "SENIAT / Agente de Aduanas",
    proceso: "desaduanamiento",
    resumen:
      "El desaduanamiento en la circunscripción se canaliza mediante Agente de Aduanas autorizado, presentando B/L, factura, certificado de origen, DUA, DAV, declaración jurada de origen de fondos y planilla de liquidación.",
    obliga:
      "Fase Desaduanamiento de la planilla: carpeta completa + agente. PDF de carpeta física disponible para impresión.",
    estado: "vigente",
    reglaCodigo: "desaduanamiento_carpeta_completa",
    ilicitos: [
      {
        codigo: "ILC-DES-01",
        descripcion:
          "Intentar levante / salida sin carpeta SENIAT completa o sin agente autorizado.",
        vigilancia:
          "La fase no avanza hasta cargar los documentos exigidos del régimen.",
      },
      {
        codigo: "ILC-DES-02",
        descripcion:
          "Omitir declaración jurada de origen de fondos u otros recaudos obligatorios.",
        vigilancia:
          "Checklist de documentos de desaduanamiento por régimen.",
      },
    ],
    lapsos: [],
    etiquetas: ["desaduanamiento", "SENIAT", "documentos"],
  },
  {
    id: "pl-permanencia-3-anios",
    codigo: "PL-NAC-01",
    titulo: "Permanencia de 3 años y vías de nacionalización",
    tipo: "procedimiento",
    organismo: "Régimen Puerto Libre",
    proceso: "nacionalizacion",
    resumen:
      "La permanencia en el régimen y el cambio a libre circulación se rigen por el lapso de tres (3) años desde el ingreso, con vías de cambio de régimen o liberación por permanencia.",
    obliga:
      "Al completar matrícula se calcula fecha límite (ingreso + 3 años). El wizard de nacionalización sugiere la vía según años transcurridos. Cron de alertas a 90 días del vencimiento.",
    estado: "vigente",
    reglaCodigo: "nacionalizacion_permanencia_3_anios",
    ilicitos: [
      {
        codigo: "ILC-NAC-01",
        descripcion:
          "Mantener el vehículo en régimen sin gestionar nacionalización / cambio de régimen al vencer el lapso de permanencia.",
        vigilancia:
          "Dashboard + email de alerta cuando faltan ≤ 90 días para la fecha límite.",
      },
    ],
    lapsos: [
      {
        nombre: "Permanencia máxima en Puerto Libre",
        duracion: "3 años desde ingreso al PL",
        alertaDiasAntes: 90,
        alertaCodigo: "alerta_deadline_nacionalizacion",
      },
    ],
    etiquetas: ["nacionalización", "permanencia", "3 años", "lapso"],
  },
  {
    id: "pl-seguro-vigencia",
    codigo: "PL-SEG-01",
    titulo: "Vigencia de póliza de seguro del vehículo",
    tipo: "procedimiento",
    organismo: "Operación taller / aseguradora",
    proceso: "seguro",
    resumen:
      "El vehículo debe mantener cobertura vigente. La caducidad de la póliza deja al expediente expuesto en circulación y cumplimiento.",
    obliga:
      "Registrar vigenciaHasta en la fase Seguro. El cron alerta cuando faltan ≤ 30 días.",
    estado: "vigente",
    reglaCodigo: "alerta_vencimiento_seguro",
    ilicitos: [
      {
        codigo: "ILC-SEG-01",
        descripcion: "Circular o mantener expediente con póliza vencida.",
        vigilancia: "Email de alerta ≤ 30 días antes del vencimiento.",
      },
    ],
    lapsos: [
      {
        nombre: "Vencimiento de póliza",
        duracion: "Según vigenciaHasta registrada",
        alertaDiasAntes: 30,
        alertaCodigo: "alerta_vencimiento_seguro",
      },
    ],
    etiquetas: ["seguro", "lapso", "alerta"],
  },
  {
    id: "pl-embarque-bl",
    codigo: "PL-EMB-01",
    titulo: "Documentos de embarque (BL, lista, DAV, póliza)",
    tipo: "procedimiento",
    organismo: "Transporte / Agente / SENIAT",
    proceso: "embarque",
    resumen:
      "El conocimiento de embarque (B/L), lista de empaque, DAV y póliza de transporte sustentan el movimiento de la mercancía hasta el puerto de destino.",
    obliga:
      "Fase Embarque: cargar BL/guía, lista, DAV y póliza. Al subir el BL se extraen aduana, nº BL, país y fecha de llegada.",
    estado: "vigente",
    reglaCodigo: "embarque_documentos_completos",
    ilicitos: [
      {
        codigo: "ILC-EMB-01",
        descripcion:
          "Avanzar el expediente sin BL o con datos de embarque inconsistentes.",
        vigilancia:
          "La fase Embarque exige los 4 documentos antes de continuar.",
      },
    ],
    lapsos: [],
    etiquetas: ["embarque", "BL", "DAV"],
  },
  {
    id: "pl-llegada-ar-edi",
    codigo: "PL-LLE-01",
    titulo: "Acta de recepción y constancia EDI / reconocimiento",
    tipo: "procedimiento",
    organismo: "Puerto / operador / SENIAT",
    proceso: "llegada",
    resumen:
      "La llegada física se documenta con Acta de recepción (AR) y Constancia EDI / reconocimiento, más memoria fotográfica e impronta.",
    obliga:
      "Fase Llegada: AR + EDI, fotos, checklist e impronta coincidente (o forzada por operador).",
    estado: "vigente",
    reglaCodigo: "llegada_documentos_impronta",
    ilicitos: [
      {
        codigo: "ILC-LLE-01",
        descripcion:
          "Dar por recibido un vehículo sin AR/EDI o con impronta que no coincide con el serial del expediente.",
        vigilancia:
          "Bloqueo de avance si la impronta no coincide (salvo forzar con permiso).",
      },
    ],
    lapsos: [],
    etiquetas: ["llegada", "AR", "EDI", "impronta"],
  },
  {
    id: "pl-ley-puerto-libre",
    codigo: "PL-REF-01",
    titulo: "Ley del Puerto Libre (referencia)",
    tipo: "ley",
    organismo: "Marco legal Venezuela",
    proceso: "transversal",
    resumen:
      "Marco general del régimen preferencial de Puerto Libre. Ficha de consulta operativa; ampliar con textos oficiales y resoluciones de Gaceta.",
    obliga:
      "Consultar antes de excepciones. No bloquea altas por sí sola; alimenta el criterio del operador.",
    estado: "referencia",
    reglaCodigo: null,
    ilicitos: [
      {
        codigo: "ILC-REF-01",
        descripcion:
          "Aplicar beneficios de Puerto Libre fuera del ámbito o sin cumplir requisitos del régimen.",
        vigilancia: "Consulta + selección correcta de régimen al alta.",
      },
    ],
    lapsos: [],
    etiquetas: ["ley", "referencia", "Puerto Libre"],
  },
  {
    id: "ve-loa-aduanas",
    codigo: "VE-LOA-01",
    titulo: "Ley Orgánica de Aduanas (referencia operativa)",
    tipo: "ley",
    organismo: "SENIAT / Asamblea Nacional",
    proceso: "transversal",
    resumen:
      "Marco de obligaciones aduaneras: declaración, tributos, plazos y tipificación de ilícitos aduaneros. Guía operativa para el expediente; no sustituye el texto oficial.",
    obliga:
      "Mantener documentación veraz y completa en cada fase. Alertar lapsos de nacionalización y seguro vinculados al expediente.",
    estado: "referencia",
    reglaCodigo: null,
    ilicitos: [
      {
        codigo: "ILC-LOA-01",
        descripcion:
          "Declaración inexacta u omisión de documentos exigidos en el despacho.",
        vigilancia:
          "Checklist por fase + carpeta SENIAT; cupo persona natural enforceable.",
      },
      {
        codigo: "ILC-LOA-02",
        descripcion:
          "Incumplimiento de plazos legales de permanencia o presentación.",
        vigilancia:
          "Alertas de deadline de nacionalización (90 días) y seguimiento en dashboard.",
      },
    ],
    lapsos: [
      {
        nombre: "Plazos de permanencia / presentación (según régimen)",
        duracion: "Según régimen y acto administrativo",
        alertaDiasAntes: 90,
        alertaCodigo: "alerta_deadline_nacionalizacion",
      },
    ],
    etiquetas: ["ley", "aduanas", "ilícitos", "referencia"],
  },
  {
    id: "ve-codigo-organico-tributario",
    codigo: "VE-COT-01",
    titulo: "Código Orgánico Tributario (referencia)",
    tipo: "codigo",
    organismo: "SENIAT",
    proceso: "transversal",
    resumen:
      "Marco de obligaciones formales y materiales frente a la Administración Tributaria. Soporte de buenas prácticas documentales en el expediente.",
    obliga:
      "Conservar RIF vigente del importador, declaraciones y soportes del despacho asociados al vehículo.",
    estado: "referencia",
    reglaCodigo: null,
    ilicitos: [
      {
        codigo: "ILC-COT-01",
        descripcion:
          "Operar con RIF inválido o datos fiscales del importador inconsistentes.",
        vigilancia:
          "Validación de formato RIF al alta de cliente; OCR de carnet RIF.",
      },
    ],
    lapsos: [],
    etiquetas: ["código", "tributario", "RIF", "referencia"],
  },
  {
    id: "ve-regimenes-importacion",
    codigo: "VE-REG-01",
    titulo: "Cinco regímenes de importación vehicular",
    tipo: "reglamento",
    organismo: "SENIAT / INTT",
    proceso: "alta",
    resumen:
      "Ordinario, Equipaje, Puerto Libre, Diplomático y Admisión temporal. La planilla es única; cada régimen añade recaudos y reglas (cupo, nacionalización PL, etc.).",
    obliga:
      "Seleccionar régimen al alta. Desaduanamiento exige carpeta base + documentos del régimen.",
    estado: "vigente",
    reglaCodigo: "regimenes_importacion_variantes",
    ilicitos: [
      {
        codigo: "ILC-REG-01",
        descripcion:
          "Declarar un régimen distinto al aplicable para evadir recaudos o cupos.",
        vigilancia:
          "Régimen fijo en el expediente; carpetas y cupo según configuración del régimen.",
      },
    ],
    lapsos: [],
    etiquetas: ["régimen", "ordinario", "equipaje", "diplomático", "temporal"],
  },
];

/** Resumen de vigilancia activa (lo que el sistema ya hace). */
export type VigilanciaActivaItem = {
  id: string;
  titulo: string;
  tipo: "bloqueo" | "alerta" | "checklist";
  descripcion: string;
  normaCodigo: string;
};

export function listVigilanciaActiva(): VigilanciaActivaItem[] {
  return [
    {
      id: "vig-cupo",
      titulo: "Cupo persona natural",
      tipo: "bloqueo",
      descripcion:
        "Impide registrar un segundo vehículo (RIF V/E) dentro de 3 años.",
      normaCodigo: "PL-CUP-PN-01",
    },
    {
      id: "vig-nac",
      titulo: "Lapso de nacionalización",
      tipo: "alerta",
      descripcion:
        "Email + dashboard cuando faltan ≤ 90 días para la fecha límite (ingreso + 3 años).",
      normaCodigo: "PL-NAC-01",
    },
    {
      id: "vig-seg",
      titulo: "Vencimiento de seguro",
      tipo: "alerta",
      descripcion: "Email cuando faltan ≤ 30 días para vigenciaHasta.",
      normaCodigo: "PL-SEG-01",
    },
    {
      id: "vig-fases",
      titulo: "Documentos por fase aduanera",
      tipo: "checklist",
      descripcion:
        "No se avanza Embarque, Llegada ni Desaduanamiento sin los recaudos exigidos.",
      normaCodigo: "PL-EMB-01 / PL-LLE-01 / PL-DES-01",
    },
  ];
}

export function getNormaByRegla(reglaCodigo: string): NormaLegal | undefined {
  return NORMAS_LEGALES.find((n) => n.reglaCodigo === reglaCodigo);
}

export function listNormasLegales(): NormaLegal[] {
  return NORMAS_LEGALES;
}

export function listNormasConLapsos(): NormaLegal[] {
  return NORMAS_LEGALES.filter((n) => n.lapsos.length > 0);
}

export function listNormasConIlicitos(): NormaLegal[] {
  return NORMAS_LEGALES.filter((n) => n.ilicitos.length > 0);
}

export function countIlicitosCatalogados(): number {
  return NORMAS_LEGALES.reduce((acc, n) => acc + n.ilicitos.length, 0);
}

export function countLapsosCatalogados(): number {
  return NORMAS_LEGALES.reduce((acc, n) => acc + n.lapsos.length, 0);
}
