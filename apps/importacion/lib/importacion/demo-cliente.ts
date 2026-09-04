import { z } from "zod";
import { REGIMEN_IMPORTACION_LABELS, REGIMENES_IMPORTACION } from "./regimenes";
import { IMPORTACION_BASE, SMARTIMPORT_DEMO_EXPEDIENTE_PATH, SMARTIMPORT_DEMO_FASES_PATH } from "./paths";

export const DEMO_CUESTIONARIO_STORAGE_KEY = "smartimport-demo-cliente-v1";

const emptyEnum = z.literal("");

export const demoRolSchema = z.enum([
  "importador",
  "concesionario",
  "aduanera",
  "taller",
  "mixto",
  "otro",
]);
export const demoVolumenSchema = z.enum(["lt10", "10-50", "gt50"]);
export const demoLlegadaSchema = z.enum(["bl", "unidad", "ambos"]);
export const demoRegimenSchema = z.enum(REGIMENES_IMPORTACION);
export const demoPdfSeniatSchema = z.enum(["cubre", "falta", "no_aplica"]);
export const demoPlacaQuienSchema = z.enum(["ellos", "cliente_final", "ambos"]);
export const demoTernarioSchema = z.enum(["si", "no", "despues"]);
export const demoCargaSchema = z.enum(["masiva", "una", "ambas"]);
export const demoAvisosSchema = z.enum(["whatsapp", "telegram", "email", "nada"]);
export const demoAgenteSchema = z.enum(["entra", "solo_nombre", "no"]);
export const demoAislamientoSchema = z.enum(["un_equipo", "por_importador"]);
export const demoPilotoSchema = z.enum(["si", "no"]);
export const demoPersonasSchema = z.enum(["1", "2-5", "6+"]);

export const demoCuestionarioSchema = z.object({
  clienteNombre: z.string().trim().max(120).default(""),
  fechaIso: z.string().trim().max(32).default(""),
  rol: z.union([demoRolSchema, emptyEnum]).default(""),
  rolOtro: z.string().trim().max(80).default(""),
  personas: z.union([demoPersonasSchema, emptyEnum]).default(""),
  volumen: z.union([demoVolumenSchema, emptyEnum]).default(""),
  llegada: z.union([demoLlegadaSchema, emptyEnum]).default(""),
  regimen: z.union([demoRegimenSchema, emptyEnum]).default(""),
  docsRetraso: z.string().trim().max(500).default(""),
  pdfSeniat: z.union([demoPdfSeniatSchema, emptyEnum]).default(""),
  pdfSeniatFalta: z.string().trim().max(240).default(""),
  placaQuien: z.union([demoPlacaQuienSchema, emptyEnum]).default(""),
  nfc: z.union([demoTernarioSchema, emptyEnum]).default(""),
  carga: z.union([demoCargaSchema, emptyEnum]).default(""),
  avisos: z.union([demoAvisosSchema, emptyEnum]).default(""),
  agenteAduanal: z.union([demoAgenteSchema, emptyEnum]).default(""),
  aislamiento: z.union([demoAislamientoSchema, emptyEnum]).default(""),
  piloto: z.union([demoPilotoSchema, emptyEnum]).default(""),
  pilotoFecha: z.string().trim().max(80).default(""),
  faltante: z.string().trim().max(400).default(""),
  sirveHoy: z.string().trim().max(400).default(""),
  pidePiloto: z.string().trim().max(400).default(""),
  quedaFuera: z.string().trim().max(400).default(""),
});

export type DemoCuestionario = z.infer<typeof demoCuestionarioSchema>;

export const EMPTY_DEMO_CUESTIONARIO: DemoCuestionario =
  demoCuestionarioSchema.parse({});

export function parseDemoCuestionario(raw: unknown): DemoCuestionario {
  const parsed = demoCuestionarioSchema.safeParse(raw);
  if (!parsed.success) return { ...EMPTY_DEMO_CUESTIONARIO };
  return parsed.data;
}

export const DEMO_ROL_LABELS: Record<z.infer<typeof demoRolSchema>, string> = {
  importador: "importador",
  concesionario: "concesionario",
  aduanera: "aduana / agente aduanal",
  taller: "taller",
  mixto: "varios roles a la vez",
  otro: "otro perfil",
};

export const DEMO_VOLUMEN_LABELS: Record<
  z.infer<typeof demoVolumenSchema>,
  string
> = {
  lt10: "<10",
  "10-50": "10–50",
  gt50: "50+",
};

export const DEMO_LLEGADA_LABELS: Record<
  z.infer<typeof demoLlegadaSchema>,
  string
> = {
  bl: "por BL / contenedor",
  unidad: "de a una unidad",
  ambos: "BL y unidad, según el lote",
};

export const DEMO_PDF_LABELS: Record<
  z.infer<typeof demoPdfSeniatSchema>,
  string
> = {
  cubre: "el PDF SENIAT cubre lo que consignan",
  falta: "al PDF SENIAT le falta algo",
  no_aplica: "el PDF SENIAT no aplica (otro régimen)",
};

export const DEMO_PLACA_LABELS: Record<
  z.infer<typeof demoPlacaQuienSchema>,
  string
> = {
  ellos: "ellos cargan placa y circulación",
  cliente_final: "el cliente final los carga",
  ambos: "a veces ellos, a veces el cliente",
};

export const DEMO_CARGA_LABELS: Record<
  z.infer<typeof demoCargaSchema>,
  string
> = {
  masiva: "carga masiva (facturas / PDF)",
  una: "alta una a una",
  ambas: "ambas, según el lote",
};

export const DEMO_AVISOS_LABELS: Record<
  z.infer<typeof demoAvisosSchema>,
  string
> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  email: "email",
  nada: "sin avisos",
};

export const DEMO_AGENTE_LABELS: Record<
  z.infer<typeof demoAgenteSchema>,
  string
> = {
  entra: "el agente aduanal debe entrar al sistema",
  solo_nombre: "solo sale el nombre en la carpeta",
  no: "no trabajan con agente aduanal",
};

export const DEMO_AISLAMIENTO_LABELS: Record<
  z.infer<typeof demoAislamientoSchema>,
  string
> = {
  un_equipo: "un solo equipo ve todo",
  por_importador: "cada importador aislado",
};

export type DemoUnidad = {
  id: "A" | "B" | "C";
  titulo: string;
  estado: string;
  paraQue: string;
  href: string;
  cta: string;
};

export const DEMO_UNIDADES: readonly DemoUnidad[] = [
  {
    id: "A",
    titulo: "Unidad A — recién extraída",
    estado: "Factura + certificado de origen",
    paraQue: "Wow de OCR / carga masiva: el lote nace de los papeles.",
    href: `${IMPORTACION_BASE}/importaciones/nueva`,
    cta: "Nueva importación",
  },
  {
    id: "B",
    titulo: "Unidad B — en cola",
    estado: "Embarque o llegada, agrupada por BL",
    paraQue: "El día a día es la cola, no la ficha.",
    href: `${IMPORTACION_BASE}#cola-embarque`,
    cta: "Cola de embarque",
  },
  {
    id: "C",
    titulo: "Unidad C — para desaduanar",
    estado: "Lista para carpeta SENIAT",
    paraQue: "Cerrar con el Expediente PDF que se imprime y consigna.",
    href: IMPORTACION_BASE,
    cta: "Dashboard",
  },
] as const;

export type DemoGuionPaso = {
  id: string;
  minutos: string;
  titulo: string;
  detalle: string;
};

export const DEMO_PREP: readonly { id: string; texto: string }[] = [
  {
    id: "cuenta",
    texto: "Cuenta sandbox (un taller demo). Nunca mezclar con expedientes reales.",
  },
  {
    id: "lote",
    texto: "Un lote de 3 unidades: A extraída, B en cola, C lista para SENIAT.",
  },
  {
    id: "papeles",
    texto: "Factura, BL y RIF del cliente si los dieron; si no, PDFs anónimos.",
  },
  {
    id: "login",
    texto: `Entrar tú en ${IMPORTACION_BASE}. El cliente mira primero; toca 5 minutos al final.`,
  },
];

export const DEMO_GUION: readonly DemoGuionPaso[] = [
  {
    id: "escuchar",
    minutos: "0–10",
    titulo: "Ellos hablan",
    detalle:
      "Antes de abrir la app: ¿unidades/mes? ¿quién carga papeles? ¿Puerto Libre u otro régimen? ¿agente aduanal? Anota; no vendas todavía.",
  },
  {
    id: "escena1",
    minutos: "10–20",
    titulo: "Escena 1 — Extraer",
    detalle:
      "Carga masiva / Extraer con factura + certificado. Aparecen VIN, marca, CIF, expediente PL-…. Mensaje: el lote nace de los papeles, no de un Excel.",
  },
  {
    id: "escena2",
    minutos: "20–28",
    titulo: "Escena 2 — Dashboard",
    detalle:
      "Colas Por completar embarque, Llegada, SENIAT, Nacionalizar. Si hay varios, abrir/cerrar un BL. Mensaje: el día a día es la cola.",
  },
  {
    id: "escena3",
    minutos: "28–35",
    titulo: "Escena 3 — PDF SENIAT",
    detalle:
      "Una ficha → desaduanamiento → Expediente PDF SENIAT. Si hay tiempo: sticker NFC o alerta de nacionalización (3 años).",
  },
  {
    id: "prueba",
    minutos: "35–45",
    titulo: "Ellos prueban",
    detalle:
      "Pestaña Probar: crear un cliente, cargar una importación, o abrir la carga precargada (factura + certificado → BL → 3 expedientes). Usan su cuenta; el espacio es el suyo, no tus expedientes.",
  },
  {
    id: "cuestionario",
    minutos: "45–60",
    titulo: "Cuestionario",
    detalle:
      "En voz alta, tú apuntas en esta misma página. No mandes un form largo antes de que hayan visto la cola.",
  },
];

export const DEMO_NO_HACER: readonly string[] = [
  "No recorras Registro → Matrícula entero. Si preguntan por una fase, ábrela.",
  "No demuestres roles máster ni paneles internos.",
  "No prometas Stripe, Telegram ni un dominio propio como parte del piloto.",
  "No los dejes en tus expedientes de producción: ellos trabajan en su propio espacio.",
];

export function demoProbarLoginHref(redirectTo: string): string {
  const path = redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`;
  const params = new URLSearchParams({
    redirectTo: path,
    mode: "signup",
    from: "demo",
  });
  return `${IMPORTACION_BASE}/login?${params.toString()}`;
}

export const DEMO_PROBAR_ACCIONES = [
  {
    id: "cliente",
    titulo: "Crear un cliente",
    detalle:
      "Alta de importador (nombre, RIF o cédula, dirección fiscal). Queda solo en su espacio.",
    href: demoProbarLoginHref(`${IMPORTACION_BASE}/clientes`),
    cta: "Crear cliente",
  },
  {
    id: "importacion",
    titulo: "Cargar una importación",
    detalle:
      "En el mismo flujo pueden crear el cliente y subir factura + certificado. Cada VIN genera un expediente PL-…",
    href: demoProbarLoginHref(`${IMPORTACION_BASE}/importaciones/nueva`),
    cta: "Cargar importación",
  },
  {
    id: "expediente",
    titulo: "Carga precargada",
    detalle:
      "Una carga con factura + certificado, se unifica en un BL y se parte en 3 expedientes Hilux. Los PDF salen de la nube.",
    href: demoProbarLoginHref(SMARTIMPORT_DEMO_EXPEDIENTE_PATH),
    cta: "Abrir carga y cargar PDF",
  },
  {
    id: "fases",
    titulo: "Un expediente por fase",
    detalle:
      "Deja un Hilux de prueba en cada cola (registro → placa) para recorrer el dashboard.",
    href: demoProbarLoginHref(SMARTIMPORT_DEMO_FASES_PATH),
    cta: "Crear 8 expedientes",
  },
] as const;

function dash(value: string | undefined): string {
  const t = value?.trim();
  return t ? t : "—";
}

function pickLabel<T extends string>(
  value: T | "",
  labels: Record<T, string>
): string {
  if (!value) return "—";
  return labels[value];
}

function rolLine(data: DemoCuestionario): string {
  if (data.rol === "otro") {
    return dash(data.rolOtro) === "—" ? "otro perfil" : data.rolOtro.trim();
  }
  return pickLabel(data.rol, DEMO_ROL_LABELS);
}

function regimenLine(data: DemoCuestionario): string {
  if (!data.regimen) return "—";
  return REGIMEN_IMPORTACION_LABELS[data.regimen];
}

function pilotoLine(data: DemoCuestionario): string {
  if (data.piloto === "si") {
    const cuando = data.pilotoFecha.trim();
    return cuando
      ? `1 lote real, fecha ${cuando}`
      : "1 lote real (fecha por confirmar)";
  }
  if (data.piloto === "no") return "sin piloto esta semana";
  return "—";
}

/** Una página para mandar al día siguiente. */
export function buildMapaDeseos(data: DemoCuestionario): string {
  const nombre = data.clienteNombre.trim() || "Cliente";
  const fecha = data.fechaIso.trim() || "sin fecha";
  const lines = [
    `Demo SmartImport — ${nombre} (${fecha})`,
    "",
    `Ustedes son ${rolLine(data)}, ${pickLabel(data.volumen, DEMO_VOLUMEN_LABELS)} unidades/mes, régimen ${regimenLine(data)}.`,
    `Lo que ya les sirve: ${dash(data.sirveHoy)}.`,
    `Lo que piden para el piloto: ${dash(data.pidePiloto)}.`,
    `Lo que queda fuera (v2): ${dash(data.quedaFuera)}.`,
    `Siguiente paso: ${pilotoLine(data)}.`,
    "",
    "Notas",
    `- Personas que tocarían el sistema: ${pickLabel(data.personas, { "1": "1", "2-5": "2–5", "6+": "6+" })}`,
    `- Llegan: ${pickLabel(data.llegada, DEMO_LLEGADA_LABELS)}`,
    `- Docs que retrasan: ${dash(data.docsRetraso)}`,
    `- PDF SENIAT: ${pickLabel(data.pdfSeniat, DEMO_PDF_LABELS)}${data.pdfSeniat === "falta" && data.pdfSeniatFalta.trim() ? ` (${data.pdfSeniatFalta.trim()})` : ""}`,
    `- Placa y título: ${pickLabel(data.placaQuien, DEMO_PLACA_LABELS)}`,
    `- NFC / enlace público: ${pickLabel(data.nfc, { si: "sí", no: "no", despues: "después" })}`,
    `- Alta: ${pickLabel(data.carga, DEMO_CARGA_LABELS)}`,
    `- Avisos: ${pickLabel(data.avisos, DEMO_AVISOS_LABELS)}`,
    `- Agente aduanal: ${pickLabel(data.agenteAduanal, DEMO_AGENTE_LABELS)}`,
    `- Datos: ${pickLabel(data.aislamiento, DEMO_AISLAMIENTO_LABELS)}`,
    `- Lo que más faltó hoy: ${dash(data.faltante)}`,
  ];
  return lines.join("\n");
}
