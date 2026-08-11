import {
  createDocumentJsonCompletion,
  getPdfPlainText,
  renderPdfPagesAsPng,
} from "@/lib/ai/document-json-completion";
import {
  anioFromVin,
  compressImageForVision,
  cropImageBuffer,
  rotateImageBuffer,
} from "@/lib/ai/image-orient";
import { createVisionJsonCompletion, createVisionVinListCompletion } from "@/lib/ai/vision-completion";
import type { PuertoLibreRegistroScanFields } from "@/lib/importacion/scan-fields";
import {
  countValidVinsInText,
  mergeFacturaMultiByVin,
  parseMavHojaAnexaFromText,
  sanitizeFacturaMulti,
  scoreFacturaMulti,
} from "@/lib/importacion/factura-row-fidelity";
import { extractVinsWithTesseract } from "@/lib/importacion/ocr-vin-tesseract";

export type { PuertoLibreRegistroScanFields } from "@/lib/importacion/scan-fields";

export type FacturaComercialExtraida = {
  marca: string | null;
  modelo: string | null;
  color: string | null;
  anio: number | null;
  serial_motor: string | null;
  serial_carroceria: string | null;
  kilometraje: number | null;
  condicion: "nuevo" | "usado" | null;
  es_subasta: boolean | null;
  valor_cif: number | null;
  pais_origen: string | null;
  importador_nombre: string | null;
  importador_documento: string | null;
  importador_telefono: string | null;
  importador_email: string | null;
};

export type BlExtraido = {
  numero_bl: string | null;
  fecha_llegada_buque: string | null;
  aduana: string | null;
  pais_origen: string | null;
  valor_cif: number | null;
  importador_nombre: string | null;
  importador_documento: string | null;
  importador_telefono: string | null;
  importador_email: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  anio: number | null;
  serial_motor: string | null;
  serial_carroceria: string | null;
  observaciones: string | null;
};

const FACTURA_PROMPT = `Eres un extractor de datos de FACTURAS COMERCIALES de vehículos (commercial invoice / factura de venta / proforma / factura de compra).
Lee SOLO lo que aparece escrito en el documento (texto o imagen). NO inventes ni completes de memoria.

Extrae en JSON con estas claves exactas:
- marca (string: fabricante, ej. Nissan, Chery, Toyota)
- modelo (string: línea/modelo comercial)
- color (string: color tal como aparece)
- anio (number: año del vehículo o del modelo si aparece; null si no está)
- serial_motor (string: Nº motor / engine no.)
- serial_carroceria (string: VIN de 17 caracteres, chasis o serial de carrocería; prioriza VIN)
- kilometraje (number: odómetro en km o millas si aparece; si el vehículo es nuevo y no aparece usa 0)
- condicion ("nuevo" o "usado" según el documento; null si no se deduce)
- es_subasta (boolean si indica subasta/auction; null si no aparece)
- valor_cif (number: valor CIF, unit price o total en USD si aparece un solo vehículo)
- pais_origen (string)
- importador_nombre (string: buyer / consignee / importador / comprador)
- importador_documento (string: RIF/NIT/tax id / cédula del importador si aparece)
- importador_telefono (string)
- importador_email (string)

Reglas:
- Si un dato no se ve con claridad, usa null (no adivines).
- Conserva mayúsculas de VIN/seriales.
- Responde SOLO JSON válido.`;

const BL_PROMPT = `Eres un extractor de conocimientos de embarque / Bill of Lading / BL / guía de carga de un vehículo.
Lee SOLO lo escrito en el documento. NO inventes.

Extrae en JSON con estas claves exactas:
- numero_bl (string: B/L No., BL number, guía)
- fecha_llegada_buque (string YYYY-MM-DD: ETA, arrival, llegada del buque o fecha del BL si es la única)
- aduana (string: puerto de destino, discharge port, aduana)
- pais_origen (string: país o puerto de origen / loading)
- valor_cif (number si aparece valor declarado en USD)
- importador_nombre (string: consignee / notify party / importador)
- importador_documento (string: RIF/NIT/tax id del consignee)
- importador_telefono (string)
- importador_email (string)
- marca (string si la descripción de mercancía lo indica)
- modelo (string)
- color (string)
- anio (number)
- serial_motor (string)
- serial_carroceria (string: VIN/chasis)
- observaciones (string breve: buque, voyage, contenedor si ayuda)
Si no encuentras un dato, usa null. Responde solo JSON.`;

function parseString(value: unknown): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^\d.,-]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseIntSafe(value: unknown): number | null {
  const n = parseNumber(value);
  if (n == null) return null;
  return Math.round(n);
}

function parseCondicion(value: unknown): "nuevo" | "usado" | null {
  const raw = parseString(value)?.toLowerCase();
  if (!raw) return null;
  if (/nuevo|new|0\s*km|zero/.test(raw)) return "nuevo";
  if (/usado|used|pre-?owned|second/.test(raw)) return "usado";
  if (raw === "nuevo" || raw === "usado") return raw;
  return null;
}

function parseBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const raw = parseString(value)?.toLowerCase();
  if (!raw) return null;
  if (["true", "si", "sí", "yes", "1", "auction", "subasta"].includes(raw)) {
    return true;
  }
  if (["false", "no", "0"].includes(raw)) return false;
  return null;
}

function parseFechaIso(value: unknown): string | null {
  const raw = parseString(value);
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const mdy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (mdy) {
    const [, a, b, yy] = mdy;
    const year = Number(yy) + 2000;
    // Prefer DD/MM for LatAm docs when ambiguous.
    return `${year}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
  }
  return null;
}

function compactSerial(value: string | null): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s\-]/g, "").toUpperCase();
  return compact || null;
}

/** Chery pone el VIN en la columna Code; MAV en Chasis. */
function resolveVinCandidate(v: Record<string, unknown>): string | null {
  const keys = [
    "serial_carroceria",
    "vin",
    "vin_number",
    "chasis",
    "no_de_chasis",
    "numero_chasis",
    "code",
    "codigo",
    "codigo_modelo",
  ] as const;
  for (const key of keys) {
    const raw = parseString(v[key]);
    if (!raw) continue;
    const compact = compactSerial(raw);
    if (compact && /^[A-HJ-NPR-Z0-9]{17}$/.test(compact)) {
      return compact;
    }
  }
  return null;
}

function mapFactura(parsed: Record<string, unknown>): FacturaComercialExtraida {
  const vinFromCode = resolveVinCandidate(parsed);
  return {
    marca: parseString(parsed.marca),
    modelo: parseString(parsed.modelo),
    color: parseString(parsed.color),
    anio: parseIntSafe(parsed.anio ?? parsed.año ?? parsed.year),
    serial_motor: compactSerial(
      parseString(
        parsed.serial_motor ??
          parsed.engine_number ??
          parsed.no_de_motor ??
          parsed.numero_motor
      )
    ),
    serial_carroceria:
      compactSerial(
        parseString(
          parsed.serial_carroceria ??
            parsed.vin ??
            parsed.vin_number ??
            parsed.chasis ??
            parsed.no_de_chasis ??
            parsed.numero_chasis
        )
      ) ?? vinFromCode,
    kilometraje: parseIntSafe(parsed.kilometraje ?? parsed.odometro ?? parsed.odometer),
    condicion: parseCondicion(parsed.condicion ?? parsed.condition),
    es_subasta: parseBool(parsed.es_subasta ?? parsed.subasta ?? parsed.auction),
    valor_cif: parseNumber(parsed.valor_cif ?? parsed.cif ?? parsed.total ?? parsed.precio),
    pais_origen: parseString(parsed.pais_origen ?? parsed.country_of_origin),
    importador_nombre: parseString(
      parsed.importador_nombre ?? parsed.buyer ?? parsed.consignee
    ),
    importador_documento: parseString(
      parsed.importador_documento ?? parsed.rif ?? parsed.tax_id
    ),
    importador_telefono: parseString(parsed.importador_telefono),
    importador_email: parseString(parsed.importador_email),
  };
}

/** Une nº unidad / llave / código de hoja anexa en observaciones. */
export function buildHojaAnexaObservaciones(
  v: Record<string, unknown>
): string | null {
  const parts: string[] = [];
  const unidad = parseString(
    v.numero_unidad ?? v.no_unidad ?? v.unit_no ?? v.no
  );
  const llave = parseString(
    v.numero_llave ?? v.no_llave ?? v.key_number ?? v.key_no
  );
  const codigoRaw = parseString(
    v.codigo_modelo ?? v.codigo ?? v.code ?? v.model_code
  );
  // Chery: Code = VIN → no listarlo como «Código».
  const codigo =
    codigoRaw && /^[A-HJ-NPR-Z0-9]{17}$/i.test(codigoRaw.replace(/[\s\-]/g, ""))
      ? null
      : codigoRaw;
  if (unidad) parts.push(`Unidad ${unidad}`);
  if (llave) parts.push(`Llave ${llave}`);
  if (codigo) parts.push(`Código ${codigo}`);
  const obs = parseString(v.observaciones);
  if (obs && !parts.some((p) => obs.includes(p))) parts.push(obs);
  return parts.length ? parts.join(" · ") : null;
}

function resolveModeloFromHojaAnexa(v: Record<string, unknown>): string | null {
  const modelo = parseString(
    v.modelo ?? v.model ?? v.marks_and_numbers ?? v.marks ?? v.description_model
  );
  if (modelo) return modelo;
  const codigo = parseString(v.codigo_modelo ?? v.codigo ?? v.code);
  // Códigos largos tipo MAV (SB29AI7W5…) no son modelo comercial.
  if (codigo && codigo.length <= 20 && !/^[A-Z]{2}\d{2}[A-Z0-9]{8,}$/i.test(codigo)) {
    return codigo;
  }
  return null;
}

/**
 * En hojas anexas a veces Color y Código vienen pegados ("WC2 NNB SB29…").
 * En facturas Chery el color es nombre ("NASDAQ SILVER") — no partir.
 */
export function splitColorAndCodigo(
  colorRaw: string | null,
  codigoRaw: string | null
): { color: string | null; codigo: string | null } {
  if (codigoRaw?.trim()) {
    return { color: colorRaw, codigo: codigoRaw.trim() };
  }
  if (!colorRaw?.trim()) return { color: null, codigo: null };
  const raw = colorRaw.trim();
  const m = raw.match(/^([A-Z0-9]{2,4})\s+([A-Z0-9]{3,}\s+[A-Z0-9]{8,})$/i);
  if (m) {
    return { color: m[1]!.toUpperCase(), codigo: m[2]!.trim().toUpperCase() };
  }
  return { color: raw, codigo: null };
}

function mapBl(parsed: Record<string, unknown>): BlExtraido {
  return {
    numero_bl:
      parseString(parsed.numero_bl ?? parsed.bl ?? parsed.bill_of_lading)?.toUpperCase() ??
      null,
    fecha_llegada_buque: parseFechaIso(
      parsed.fecha_llegada_buque ?? parsed.eta ?? parsed.arrival_date
    ),
    aduana: parseString(parsed.aduana ?? parsed.port_of_discharge ?? parsed.destino),
    pais_origen: parseString(parsed.pais_origen ?? parsed.port_of_loading),
    valor_cif: parseNumber(parsed.valor_cif ?? parsed.cif),
    importador_nombre: parseString(
      parsed.importador_nombre ?? parsed.consignee ?? parsed.notify_party
    ),
    importador_documento: parseString(parsed.importador_documento ?? parsed.rif),
    importador_telefono: parseString(parsed.importador_telefono),
    importador_email: parseString(parsed.importador_email),
    marca: parseString(parsed.marca),
    modelo: parseString(parsed.modelo),
    color: parseString(parsed.color),
    anio: parseIntSafe(parsed.anio ?? parsed.año),
    serial_motor: parseString(parsed.serial_motor)?.toUpperCase() ?? null,
    serial_carroceria:
      parseString(parsed.serial_carroceria)?.toUpperCase() ??
      parseString(parsed.vin)?.toUpperCase() ??
      null,
    observaciones: parseString(parsed.observaciones),
  };
}

export async function extractFacturaComercialFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<FacturaComercialExtraida> {
  const parsed = await createDocumentJsonCompletion({
    prompt: FACTURA_PROMPT,
    buffer,
    mimeType,
    maxTokens: 1200,
    maxPdfPages: 4,
    preferHighDetail: true,
  });
  let mapped = mapFactura(parsed);

  // Si casi no hay datos críticos, forzar visión (PDF con texto basura / OCR pobre).
  const hasCritical =
    Boolean(mapped.marca?.trim()) ||
    Boolean(mapped.serial_carroceria?.trim()) ||
    Boolean(mapped.modelo?.trim());
  if (!hasCritical && mimeType.toLowerCase().includes("pdf")) {
    const retry = await createDocumentJsonCompletion({
      prompt: FACTURA_PROMPT,
      buffer,
      mimeType,
      maxTokens: 1200,
      maxPdfPages: 4,
      preferHighDetail: true,
      forceRasterVision: true,
    });
    mapped = mapFactura(retry);
  }

  return mapped;
}

export async function extractBlFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<BlExtraido> {
  const parsed = await createDocumentJsonCompletion({
    prompt: BL_PROMPT,
    buffer,
    mimeType,
    maxTokens: 1200,
    maxPdfPages: 4,
    preferHighDetail: true,
  });
  return mapBl(parsed);
}

export function facturaToFormFields(
  data: FacturaComercialExtraida
): PuertoLibreRegistroScanFields {
  const fields: PuertoLibreRegistroScanFields = {};
  if (data.marca) fields.marca = data.marca;
  if (data.modelo) fields.modelo = data.modelo;
  if (data.color) fields.color = data.color;
  if (data.anio != null) fields.anio = String(data.anio);
  if (data.serial_motor) fields.serialMotor = data.serial_motor;
  if (data.serial_carroceria) {
    fields.serialCarroceria = data.serial_carroceria;
    fields.vin = data.serial_carroceria;
  }
  if (data.kilometraje != null) fields.kilometraje = String(data.kilometraje);
  if (data.condicion) fields.condicion = data.condicion;
  if (data.es_subasta != null) fields.esSubasta = data.es_subasta ? "true" : "false";
  if (data.valor_cif != null) fields.valorCif = String(data.valor_cif);
  if (data.pais_origen) fields.paisOrigen = data.pais_origen;
  if (data.importador_nombre) fields.importadorNombre = data.importador_nombre;
  if (data.importador_documento) fields.importadorDocumento = data.importador_documento;
  if (data.importador_telefono) fields.importadorTelefono = data.importador_telefono;
  if (data.importador_email) fields.importadorEmail = data.importador_email;
  return fields;
}

export function blToFormFields(data: BlExtraido): PuertoLibreRegistroScanFields {
  const fields: PuertoLibreRegistroScanFields = {};
  if (data.numero_bl) fields.numeroBl = data.numero_bl;
  if (data.fecha_llegada_buque) fields.fechaLlegadaBuque = data.fecha_llegada_buque;
  if (data.aduana) fields.aduana = data.aduana;
  if (data.pais_origen) fields.paisOrigen = data.pais_origen;
  if (data.valor_cif != null) fields.valorCif = String(data.valor_cif);
  if (data.importador_nombre) fields.importadorNombre = data.importador_nombre;
  if (data.importador_documento) fields.importadorDocumento = data.importador_documento;
  if (data.importador_telefono) fields.importadorTelefono = data.importador_telefono;
  if (data.importador_email) fields.importadorEmail = data.importador_email;
  if (data.marca) fields.marca = data.marca;
  if (data.modelo) fields.modelo = data.modelo;
  if (data.color) fields.color = data.color;
  if (data.anio != null) fields.anio = String(data.anio);
  if (data.serial_motor) fields.serialMotor = data.serial_motor;
  if (data.serial_carroceria) {
    fields.serialCarroceria = data.serial_carroceria;
    fields.vin = data.serial_carroceria;
  }
  if (data.observaciones) fields.observaciones = data.observaciones;
  return fields;
}

export function countFilledFields(fields: PuertoLibreRegistroScanFields): number {
  return Object.values(fields).filter((v) => v != null && String(v).trim() !== "").length;
}

const FACTURA_MULTI_PROMPT = `Eres un transcriptor fiel de FACTURAS COMERCIALES de vehículos (commercial invoice / hoja anexa / attached sheet).
REGLA DE ORO: copia SOLO lo escrito en el documento. NO inventes, NO completes de memoria, NO “arregles” seriales.

Puede ser:
A) Carátula multipágina Chery / Intercontinental: Marks and numbers | Code | Description | Qty | Unit Price | Amount.
   - "Marks and numbers" = MODELO (ej. ARRIZO 5 PRO, TIGGO 7).
   - "Code" = VIN de 17 caracteres (ej. LVVDC21B5VD713650). NO es un código de fábrica corto.
   - "Description of goods" = COLOR (ej. NASDAQ SILVER).
   - Cada fila con Qty=1 es UN vehículo. Si hay 15–20 filas, vehiculos.length debe ser 15–20.
B) HOJA ANEXA / Attached Sheet (MAV TRADE): No. | No. de Chasis (VIN) | No. de Motor | No. Llave | Color | Codigo.

FORMATO B — ejemplo de fila EXACTA a transcribir:
  00001 | MF3PB8121TJ219731 | G4FLTQ622505 | M0433 | WC2 NNB | SB29AI7W5D661VDD41I
- numero_unidad = "00001"
- serial_carroceria = VIN de 17 caracteres EXACTO (sin espacios)
- serial_motor = motor EXACTO (ej. G4FLTQ622505)
- numero_llave = EXACTO (ej. M0433)
- color = celda Color completa (ej. "WC2 NNB")
- codigo_modelo = celda Codigo completa (ej. SB29AI7W5D661VDD41I) — NUNCA como VIN
- "MAV TRADE HOLDINGS CORP" es la emisora → marca = null
- Nº factura del título → numero_factura

FIDELIDAD:
- Incluye TODAS las filas con mercancía (Qty≥1). NO te detengas en las primeras 2.
- Cada VIN distinto = un objeto en vehiculos. No fusiones filas.
- Ignora filas vacías de la plantilla.
- Si un dígito no se lee con claridad → null en ese campo (no adivines).
- Documento rotado 90°: lee igual la tabla.
- Nuevo / 0 km → condicion="nuevo", kilometraje=0.
- valor_cif unitario solo si hay precio por fila; total → valor_cif_total.
- marca tipica Chery → "Chery" si el membrete lo indica; no uses el consignatario como marca.

Responde SOLO JSON:
{
  "numero_factura": string|null,
  "importador_nombre": string|null,
  "importador_documento": string|null,
  "importador_telefono": string|null,
  "importador_email": string|null,
  "importador_direccion": string|null,
  "pais_origen": string|null,
  "aduana": string|null,
  "marca": string|null,
  "anio": number|null,
  "valor_cif_total": number|null,
  "vehiculos": [
    {
      "numero_unidad": string|null,
      "marca": string|null,
      "modelo": string|null,
      "codigo_modelo": string|null,
      "color": string|null,
      "anio": number|null,
      "serial_motor": string|null,
      "serial_carroceria": string|null,
      "numero_llave": string|null,
      "kilometraje": number|null,
      "condicion": "nuevo"|"usado"|null,
      "es_subasta": boolean|null,
      "valor_cif": number|null,
      "pais_origen": string|null
    }
  ]
}`;

/** Segunda pasada: solo tabla, máxima fidelidad de celdas. */
const FACTURA_MULTI_TABLA_PROMPT = `Transcribe ÚNICAMENTE la tabla de vehículos de esta factura / hoja anexa / commercial invoice.
Chery / Intercontinental: Marks and numbers = modelo, Code = VIN (17), Description = color, Unit Price = valor.
MAV hoja anexa: No., Chasis/VIN (17), Motor, Llave, Color, Codigo.
Incluye TODAS las filas con Qty=1 o con VIN. No te detengas en 2 filas. No inventes. Si está rotada, lee igual.
Responde SOLO JSON:
{
  "numero_factura": string|null,
  "vehiculos": [
    {
      "numero_unidad": string|null,
      "modelo": string|null,
      "serial_carroceria": string|null,
      "serial_motor": string|null,
      "numero_llave": string|null,
      "color": string|null,
      "codigo_modelo": string|null,
      "valor_cif": number|null,
      "condicion": "nuevo",
      "kilometraje": 0
    }
  ]
}`;

/** Pasada de cosecha: listar todos los VIN visibles (recuperación si faltan filas). */
const FACTURA_MULTI_VIN_HARVEST_PROMPT = `Lista TODOS los VIN / chasis de 17 caracteres visibles en esta imagen de factura.
También anota modelo y color de la misma fila si se ven.
NO omitas filas del medio ni del final. Si hay 18 VIN, vehiculos.length debe ser 18.
Responde SOLO JSON:
{
  "vehiculos": [
    {
      "modelo": string|null,
      "color": string|null,
      "serial_carroceria": string|null,
      "valor_cif": number|null,
      "condicion": "nuevo",
      "kilometraje": 0
    }
  ]
}`;

const BL_MULTI_PROMPT = `Analiza este Bill of Lading / BL / conocimiento de embarque (puede listar UNO o VARIOS vehículos / VINs).
Incluye TODOS los VIN o chasis listados en "vehiculos".
Responde SOLO JSON con:
{
  "numero_bl": string|null,
  "fecha_llegada_buque": string|null,
  "aduana": string|null,
  "pais_origen": string|null,
  "importador_nombre": string|null,
  "importador_documento": string|null,
  "importador_telefono": string|null,
  "importador_email": string|null,
  "valor_cif_total": number|null,
  "observaciones": string|null,
  "vehiculos": [
    {
      "marca": string|null,
      "modelo": string|null,
      "color": string|null,
      "anio": number|null,
      "serial_motor": string|null,
      "serial_carroceria": string|null,
      "kilometraje": number|null,
      "condicion": "nuevo"|"usado"|null,
      "valor_cif": number|null
    }
  ]
}
fecha_llegada_buque en YYYY-MM-DD si aparece (ETA / arrival).
Si la descripción es genérica sin VIN, "vehiculos" puede ser [].`;

const CERTIFICADO_ORIGEN_MULTI_PROMPT = `Analiza este CERTIFICADO DE ORIGEN / Certificate of Origin (COO) de vehículos importados.
Puede listar UNO o VARIOS vehículos (tabla o lista de chasis/VIN/motor).

Extrae datos que suelen faltar en la factura comercial:
- serial_motor / engine number (muy frecuente aquí)
- marca, modelo, color, año
- serial_carroceria / VIN / chasis
- país de origen (country of origin)
- número del certificado

IMPORTANTE:
- Incluye TODAS las unidades visibles. No omitas filas.
- Si hay una sola unidad sin tabla, "vehiculos" tendrá 1 elemento.
- No inventes seriales. Si no se lee el motor, null.

Responde SOLO JSON con:
{
  "numero_certificado_origen": string|null,
  "pais_origen": string|null,
  "marca": string|null,
  "anio": number|null,
  "importador_nombre": string|null,
  "importador_documento": string|null,
  "vehiculos": [
    {
      "marca": string|null,
      "modelo": string|null,
      "color": string|null,
      "anio": number|null,
      "serial_motor": string|null,
      "serial_carroceria": string|null,
      "numero_llave": string|null,
      "kilometraje": number|null,
      "condicion": "nuevo"|"usado"|null,
      "pais_origen": string|null
    }
  ]
}`;

export type DocMultiExtracted = {
  shared: PuertoLibreRegistroScanFields;
  vehiculos: PuertoLibreRegistroScanFields[];
};

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object");
}

function mapFacturaMultiVehiculo(
  sharedParsed: Record<string, unknown>,
  v: Record<string, unknown>
): PuertoLibreRegistroScanFields {
  const merged = { ...sharedParsed, ...v };
  const modelo =
    resolveModeloFromHojaAnexa(v) ?? resolveModeloFromHojaAnexa(sharedParsed);
  const vin = resolveVinCandidate(v) ?? resolveVinCandidate(merged);
  const codigoRaw = parseString(v.codigo_modelo ?? v.codigo ?? v.code);
  const codigoEsVin =
    !!codigoRaw &&
    /^[A-HJ-NPR-Z0-9]{17}$/i.test(codigoRaw.replace(/[\s\-]/g, ""));
  const { color, codigo } = splitColorAndCodigo(
    parseString(v.color ?? merged.color),
    codigoEsVin ? null : codigoRaw
  );
  const data = mapFactura({
    ...merged,
    modelo,
    color,
    serial_carroceria:
      vin ??
      v.serial_carroceria ??
      v.vin ??
      v.vin_number ??
      v.chasis ??
      v.no_de_chasis ??
      sharedParsed.serial_carroceria,
    serial_motor:
      v.serial_motor ??
      v.engine_number ??
      v.no_de_motor ??
      sharedParsed.serial_motor,
    // CIF unitario de la fila; no heredar total de cabecera.
    valor_cif: v.valor_cif ?? v.unit_price ?? v.amount ?? null,
  });
  const fields = facturaToFormFields(data);
  if (!fields.marca) {
    const marcaShared = parseString(sharedParsed.marca);
    if (marcaShared) fields.marca = marcaShared;
  }
  if (!fields.anio) {
    const anioShared = parseIntSafe(sharedParsed.anio);
    if (anioShared != null) fields.anio = String(anioShared);
  }
  if (!fields.anio && fields.serialCarroceria) {
    const y = anioFromVin(fields.serialCarroceria);
    if (y != null) fields.anio = String(y);
  }
  const obs = buildHojaAnexaObservaciones({
    ...v,
    codigo_modelo: codigo ?? (codigoEsVin ? null : v.codigo_modelo),
    code: codigoEsVin ? null : v.code,
    codigo: codigoEsVin ? null : v.codigo,
  });
  if (obs) fields.observaciones = obs;
  if (!fields.condicion) fields.condicion = "nuevo";
  if (fields.kilometraje == null) fields.kilometraje = "0";
  // Facturas tipo Chery no traen motor: placeholder para poder registrar y completar luego.
  if (!fields.serialMotor?.trim() && fields.serialCarroceria?.trim()) {
    fields.serialMotor = "POR-COMPLETAR";
  }
  return fields;
}

/** Deduplica por VIN/chasis; conserva el primero con más campos. */
export function dedupeVehiculosBySerial(
  vehiculos: PuertoLibreRegistroScanFields[]
): PuertoLibreRegistroScanFields[] {
  const bySerial = new Map<string, PuertoLibreRegistroScanFields>();
  const withoutSerial: PuertoLibreRegistroScanFields[] = [];

  for (const v of vehiculos) {
    const serial = compactSerial(v.serialCarroceria ?? null);
    if (!serial) {
      withoutSerial.push(v);
      continue;
    }
    const prev = bySerial.get(serial);
    if (!prev || countFilledFields(v) > countFilledFields(prev)) {
      bySerial.set(serial, {
        ...v,
        serialCarroceria: serial,
        vin: v.vin?.trim() || serial,
      });
    }
  }

  return [...bySerial.values(), ...withoutSerial];
}

function parseFacturaMultiResult(
  parsed: Record<string, unknown>
): DocMultiExtracted {
  const shared = facturaToFormFields(mapFactura(parsed));
  const dir = parseString(
    parsed.importador_direccion ?? parsed.direccion ?? parsed.address
  );
  if (dir) shared.importadorDireccion = dir;
  const aduana = parseString(
    parsed.aduana ??
      parsed.final_destination ??
      parsed.puerto_destino ??
      parsed.port_of_discharge
  );
  if (aduana) shared.aduana = aduana;
  if (!shared.paisOrigen) {
    const origen = parseString(
      parsed.pais_origen ?? parsed.port_of_loading ?? parsed.puerto_origen
    );
    if (origen) shared.paisOrigen = origen;
  }
  delete shared.valorCif;

  // Emisora MAV TRADE ≠ marca del vehículo.
  if (shared.marca && /mav\s*trade|holdings\s*corp/i.test(shared.marca)) {
    delete shared.marca;
  }

  const numeroFactura = parseString(parsed.numero_factura ?? parsed.invoice_no);
  const facturaLabel = numeroFactura ? `Factura ${numeroFactura}` : null;
  const cifTotal = parseNumber(parsed.valor_cif_total);

  let vehiculos = asRecordArray(parsed.vehiculos).map((v) => {
    const fields = mapFacturaMultiVehiculo(parsed, v);
    if (fields.marca && /mav\s*trade|holdings\s*corp/i.test(fields.marca)) {
      delete fields.marca;
    }
    const extras = [
      facturaLabel,
      cifTotal != null ? `CIF total factura ${cifTotal}` : null,
      fields.observaciones,
    ].filter((x): x is string => Boolean(x && String(x).trim()));
    fields.observaciones = extras
      .filter((x, idx) => {
        if (x.startsWith("CIF total") && fields.valorCif) return false;
        return extras.indexOf(x) === idx;
      })
      .join(" · ");
    return fields;
  });

  if (vehiculos.length === 0) {
    const single = mapFacturaMultiVehiculo(parsed, parsed);
    if (facturaLabel) {
      single.observaciones = [facturaLabel, single.observaciones]
        .filter((x): x is string => Boolean(x && String(x).trim()))
        .join(" · ");
    }
    if (countFilledFields(single) > 0) vehiculos.push(single);
  }

  vehiculos = dedupeVehiculosBySerial(vehiculos);
  return { shared, vehiculos };
}

function salvageVinsFromUnknown(
  value: unknown,
  found: Set<string> = new Set()
): string[] {
  if (typeof value === "string") {
    const matches = value.toUpperCase().match(/\b[A-HJ-NPR-Z0-9]{17}\b/g) ?? [];
    for (const m of matches) {
      if (/^[A-HJ-NPR-Z0-9]{17}$/.test(m)) found.add(m);
    }
    return [...found];
  }
  if (Array.isArray(value)) {
    for (const item of value) salvageVinsFromUnknown(item, found);
    return [...found];
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      salvageVinsFromUnknown(v, found);
    }
  }
  return [...found];
}

function enrichWithSalvagedVins(
  extracted: DocMultiExtracted,
  raw: Record<string, unknown>
): DocMultiExtracted {
  const existing = new Set(
    extracted.vehiculos
      .map((v) => compactSerial(v.serialCarroceria ?? v.vin ?? null))
      .filter(Boolean) as string[]
  );
  const salvaged = salvageVinsFromUnknown(raw).filter((vin) => !existing.has(vin));
  if (salvaged.length === 0) return extracted;
  const extras = salvaged.map((vin) =>
    sanitizeVehiculoRowLocal({
      serialCarroceria: vin,
      vin,
      serialMotor: "POR-COMPLETAR",
      condicion: "nuevo",
      kilometraje: "0",
      anio: anioFromVin(vin)?.toString(),
      marca: extracted.shared.marca,
    })
  );
  return sanitizeFacturaMulti({
    shared: extracted.shared,
    vehiculos: [...extracted.vehiculos, ...extras],
  });
}

/** Evita import circular con factura-row-fidelity sanitize en este punto. */
function sanitizeVehiculoRowLocal(
  row: PuertoLibreRegistroScanFields
): PuertoLibreRegistroScanFields {
  const vin = compactSerial(row.serialCarroceria ?? row.vin ?? null);
  const next = { ...row };
  if (vin && /^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    next.serialCarroceria = vin;
    next.vin = vin;
  }
  if (!next.serialMotor?.trim()) next.serialMotor = "POR-COMPLETAR";
  if (!next.condicion) next.condicion = "nuevo";
  if (!next.kilometraje) next.kilometraje = "0";
  if (!next.anio && vin) {
    const y = anioFromVin(vin);
    if (y != null) next.anio = String(y);
  }
  return next;
}

async function extractFacturaMultiOnce(
  buffer: Buffer,
  mimeType: string,
  prompt: string = FACTURA_MULTI_PROMPT
): Promise<DocMultiExtracted> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const parsed = await createDocumentJsonCompletion({
    prompt,
    buffer,
    mimeType,
    maxTokens: 12000,
    maxTextChars: 50000,
    maxPdfPages: 2,
    preferHighDetail: true,
    forceRasterVision: isPdf,
    renderScale: 2.4,
  });
  const extracted = sanitizeFacturaMulti(parseFacturaMultiResult(parsed));
  return enrichWithSalvagedVins(extracted, parsed);
}

async function extractFacturaMultiFromImage(
  imageBuffer: Buffer,
  mimeType: string,
  prompt: string
): Promise<DocMultiExtracted> {
  const sized = await compressImageForVision(imageBuffer);
  const parsed = await createVisionJsonCompletion({
    prompt,
    imageBuffer: sized.buffer,
    mimeType: sized.mimeType,
    maxTokens: 12000,
    preferHighDetail: true,
  });
  const extracted = sanitizeFacturaMulti(parseFacturaMultiResult(parsed));
  return enrichWithSalvagedVins(extracted, parsed);
}

/** Bandas de la zona de tabla (omitir membrete y pie). */
const TABLE_BANDS: { x: number; y: number; w: number; h: number }[] = [
  { x: 0, y: 0.2, w: 1, h: 0.4 },
  { x: 0, y: 0.45, w: 1, h: 0.4 },
];

function pickBestFacturaMulti(
  candidates: DocMultiExtracted[]
): DocMultiExtracted {
  let best = candidates[0] ?? { shared: {}, vehiculos: [] };
  let bestScore = scoreFacturaMulti(best);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const s = scoreFacturaMulti(c);
    if (
      s > bestScore ||
      (s >= bestScore - 5 && c.vehiculos.length > best.vehiculos.length)
    ) {
      best = c;
      bestScore = s;
    }
  }
  let merged = best;
  for (const c of candidates) {
    if (c === best) continue;
    merged = mergeFacturaMultiByVin(merged, c);
  }
  return sanitizeFacturaMulti(merged);
}

export async function extractFacturaMultiFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const candidates: DocMultiExtracted[] = [];

  // 1) Texto embebido (PDF digital).
  if (isPdf) {
    try {
      const plain = await getPdfPlainText(buffer);
      if (countValidVinsInText(plain) >= 2) {
        const deterministic = parseMavHojaAnexaFromText(plain);
        if (deterministic && deterministic.vehiculos.length >= 2) {
          candidates.push(sanitizeFacturaMulti(deterministic));
        }
      }
    } catch {
      // visión
    }
  }

  // 2) Página 1 sola (Chery: toda la mercancía está ahí; pág. 2 suele ser totales).
  if (isPdf) {
    try {
      const pages = await renderPdfPagesAsPng(buffer, {
        maxPages: 1,
        scale: 2.4,
      });
      const page1 = pages[0];
      if (page1) {
        try {
          candidates.push(
            await extractFacturaMultiFromImage(
              page1,
              "image/png",
              FACTURA_MULTI_PROMPT
            )
          );
        } catch {
          // ignore
        }
      }
    } catch {
      // fallback abajo
    }
  }

  // 3) Pasada del PDF completo solo si aún hay pocas filas.
  let currentBest = candidates.length
    ? pickBestFacturaMulti(candidates)
    : { shared: {}, vehiculos: [] };

  if (currentBest.vehiculos.length < 4) {
    try {
      candidates.push(
        await extractFacturaMultiOnce(buffer, mimeType, FACTURA_MULTI_PROMPT)
      );
    } catch {
      // ignore
    }
    currentBest = candidates.length
      ? pickBestFacturaMulti(candidates)
      : currentBest;
  }

  // 4) Cosecha por bandas + prompt VIN si sigue corto (timeout-friendly: máx 3 llamadas).
  if (isPdf && currentBest.vehiculos.length < 8) {
    try {
      const pages = await renderPdfPagesAsPng(buffer, {
        maxPages: 1,
        scale: 2.4,
      });
      const page1 = pages[0];
      if (page1) {
        try {
          candidates.push(
            await extractFacturaMultiFromImage(
              page1,
              "image/png",
              FACTURA_MULTI_VIN_HARVEST_PROMPT
            )
          );
        } catch {
          // ignore
        }
        for (const band of TABLE_BANDS) {
          if (pickBestFacturaMulti(candidates).vehiculos.length >= 12) break;
          try {
            const cropped = await cropImageBuffer(page1, band);
            candidates.push(
              await extractFacturaMultiFromImage(
                cropped.buffer,
                cropped.mimeType,
                FACTURA_MULTI_VIN_HARVEST_PROMPT
              )
            );
          } catch {
            // ignore band
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 5) Foto (no PDF): rotaciones solo si hace falta.
  if (!isPdf) {
    try {
      candidates.push(
        await extractFacturaMultiOnce(buffer, mimeType, FACTURA_MULTI_PROMPT)
      );
    } catch {
      // ignore
    }
    let bestSoFar = candidates.length
      ? pickBestFacturaMulti(candidates)
      : { shared: {}, vehiculos: [] };
    if (bestSoFar.vehiculos.length < 4) {
      for (const deg of [90, 270] as const) {
        try {
          const rotated = await rotateImageBuffer(buffer, deg);
          candidates.push(
            await extractFacturaMultiFromImage(
              rotated.buffer,
              rotated.mimeType,
              FACTURA_MULTI_TABLA_PROMPT
            )
          );
          bestSoFar = pickBestFacturaMulti(candidates);
          if (bestSoFar.vehiculos.length >= 6) break;
        } catch {
          // continue
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { shared: {}, vehiculos: [] };
  }

  return pickBestFacturaMulti(candidates);
}

/**
 * Etapa 1 — cosecha de VIN (prioriza listado en texto plano + recortes Chery).
 * Si no hay VIN, lanza Error con el diagnóstico de OCR (no lo oculta).
 */
export async function extractFacturaVinsStageFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const diagnostics: string[] = [];
  const vinSet = new Set<string>();

  const addVins = (vins: string[], source: string) => {
    let added = 0;
    for (const v of vins) {
      const n = v.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
      if (n.length === 17 && !vinSet.has(n)) {
        vinSet.add(n);
        added += 1;
      }
    }
    diagnostics.push(`${source}: +${added} (total ${vinSet.size})`);
  };

  const fromImageList = async (
    img: Buffer,
    imgMime: string,
    label: string
  ) => {
    try {
      const sized = await compressImageForVision(img);
      const vins = await createVisionVinListCompletion({
        imageBuffer: sized.buffer,
        mimeType: sized.mimeType,
        preferHighDetail: true,
        maxTokens: 4000,
      });
      addVins(vins, label);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      diagnostics.push(`${label}: ERROR ${msg.slice(0, 160)}`);
    }
  };

  // Texto embebido (PDF digital)
  if (isPdf) {
    try {
      const plain = await getPdfPlainText(buffer);
      const fromPlain = plain
        .toUpperCase()
        .match(/\b[A-HJ-NPR-Z0-9]{17}\b/g);
      if (fromPlain?.length) addVins(fromPlain, "texto-pdf");
      const det = parseMavHojaAnexaFromText(plain);
      if (det?.vehiculos.length) {
        addVins(
          det.vehiculos
            .map((v) => v.serialCarroceria ?? v.vin ?? "")
            .filter(Boolean),
          "parser-mav"
        );
      }
    } catch (err) {
      diagnostics.push(
        `texto-pdf: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`
      );
    }
  }

  // Raster página 1 + Tesseract (local) + visión en recortes Chery
  try {
    const pages = isPdf
      ? await renderPdfPagesAsPng(buffer, { maxPages: 1, scale: 2.8 })
      : [buffer];
    const page1 = pages[0];
    if (!page1) {
      diagnostics.push("raster: no se pudo renderizar la página 1");
    } else {
      diagnostics.push(`raster: ok ${page1.length} bytes`);

      // Recortes tipicos factura Chery: tabla y columna Code
      const cheryCrops = [
        { label: "tabla", region: { x: 0.04, y: 0.26, w: 0.92, h: 0.58 } },
        { label: "col-code", region: { x: 0.19, y: 0.35, w: 0.16, h: 0.52 } },
        { label: "col-code-2", region: { x: 0.2, y: 0.36, w: 0.15, h: 0.5 } },
        { label: "banda-sup", region: { x: 0.05, y: 0.28, w: 0.9, h: 0.35 } },
        { label: "banda-inf", region: { x: 0.05, y: 0.48, w: 0.9, h: 0.35 } },
      ] as const;

      const croppedBuffers: { label: string; buffer: Buffer; mimeType: string }[] =
        [];
      for (const crop of cheryCrops) {
        try {
          const cropped = await cropImageBuffer(page1, crop.region);
          croppedBuffers.push({
            label: crop.label,
            buffer: cropped.buffer,
            mimeType: cropped.mimeType,
          });
        } catch (err) {
          diagnostics.push(
            `${crop.label}: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`
          );
        }
      }

      // 1) Tesseract primero (no depende de OPENAI_API_KEY)
      try {
        const tessImages = croppedBuffers
          .filter((c) => c.label.startsWith("col-code"))
          .map((c) => c.buffer);
        const tess = await extractVinsWithTesseract(
          tessImages.length > 0 ? tessImages : [page1]
        );
        addVins(tess.vins, "tesseract");
        if (tess.textSample) {
          diagnostics.push(`tesseract-sample: ${tess.textSample.slice(0, 80)}`);
        }
      } catch (err) {
        diagnostics.push(
          `tesseract: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`
        );
      }

      // 2) Visión LLM solo si faltan VIN (ahorra timeout / coste)
      if (vinSet.size < 12) {
        const pageMime = isPdf ? "image/png" : mimeType;
        await fromImageList(page1, pageMime, "pagina-1");
        for (const crop of croppedBuffers) {
          if (vinSet.size >= 15) break;
          if (crop.label.startsWith("banda") && vinSet.size >= 8) continue;
          await fromImageList(crop.buffer, crop.mimeType, crop.label);
        }
      } else {
        diagnostics.push("vision: omitida (tesseract suficiente)");
      }
    }
  } catch (err) {
    diagnostics.push(
      `raster: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`
    );
  }

  // Fallback JSON harvest / tabla si aún faltan
  if (vinSet.size < 2) {
    try {
      const sized = await compressImageForVision(
        isPdf
          ? (await renderPdfPagesAsPng(buffer, { maxPages: 1, scale: 2.2 }))[0]!
          : buffer
      );
      const parsed = await createVisionJsonCompletion({
        prompt: FACTURA_MULTI_VIN_HARVEST_PROMPT,
        imageBuffer: sized.buffer,
        mimeType: sized.mimeType,
        maxTokens: 8000,
        preferHighDetail: true,
      });
      const extracted = enrichWithSalvagedVins(
        sanitizeFacturaMulti(parseFacturaMultiResult(parsed)),
        parsed
      );
      addVins(
        extracted.vehiculos.map((v) => v.serialCarroceria ?? v.vin ?? ""),
        "json-harvest"
      );
    } catch (err) {
      diagnostics.push(
        `json-harvest: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`
      );
    }
  }

  if (vinSet.size === 0) {
    throw new Error(
      `Sin VIN legibles. ${diagnostics.slice(0, 4).join(" · ") || "Revisa OPENAI_API_KEY / modelo de visión en Vercel."}`
    );
  }

  const looksChery = [...vinSet].some((v) => v.startsWith("LVV") || v.startsWith("LVT") || v.startsWith("LVD"));
  const vehiculos = [...vinSet].map((vin) =>
    sanitizeVehiculoRowLocal({
      serialCarroceria: vin,
      vin,
      serialMotor: "POR-COMPLETAR",
      condicion: "nuevo",
      kilometraje: "0",
      anio: anioFromVin(vin)?.toString(),
      ...(looksChery ? { marca: "Chery" } : {}),
    })
  );

  return {
    shared: looksChery ? { marca: "Chery" } : {},
    vehiculos,
  };
}

function buildEnrichPrompt(knownVins: string[]): string {
  const list =
    knownVins.length > 0
      ? `\nVIN YA DETECTADOS (completa cada uno; no omitas ninguno):\n${knownVins
          .map((v, i) => `${i + 1}. ${v}`)
          .join("\n")}\nSi ves VIN adicionales, añádelos.`
      : "";
  return `${FACTURA_MULTI_PROMPT}
${list}
Prioriza rellenar modelo, color, valor_cif y datos de cabecera (importador, factura, aduana).`;
}

/**
 * Etapa 2 — enriquecer filas (modelo, color, CIF, cabecera) a partir de VIN conocidos.
 */
export async function enrichFacturaRowsStageFromDocument(
  buffer: Buffer,
  mimeType: string,
  knownVins: string[]
): Promise<DocMultiExtracted> {
  const prompt = buildEnrichPrompt(knownVins.slice(0, 40));
  const candidates: DocMultiExtracted[] = [];

  try {
    const isPdf = mimeType.toLowerCase().includes("pdf");
    if (isPdf) {
      const pages = await renderPdfPagesAsPng(buffer, {
        maxPages: 1,
        scale: 2.4,
      });
      const page1 = pages[0];
      if (page1) {
        candidates.push(
          await extractFacturaMultiFromImage(page1, "image/png", prompt)
        );
      }
    }
  } catch {
    // fallback full doc
  }

  try {
    candidates.push(await extractFacturaMultiOnce(buffer, mimeType, prompt));
  } catch {
    // ignore
  }

  if (candidates.length === 0) {
    // Devolver esqueletos por VIN conocidos
    return {
      shared: {},
      vehiculos: knownVins.map((vin) =>
        sanitizeVehiculoRowLocal({
          serialCarroceria: vin,
          vin,
          serialMotor: "POR-COMPLETAR",
          condicion: "nuevo",
          kilometraje: "0",
          anio: anioFromVin(vin)?.toString(),
        })
      ),
    };
  }

  const enriched = pickBestFacturaMulti(candidates);
  // Asegurar que no se pierdan VIN de la etapa 1
  const byVin = new Map(
    enriched.vehiculos
      .map((v) => {
        const vin = compactSerial(v.serialCarroceria ?? v.vin ?? null);
        return vin ? ([vin, v] as const) : null;
      })
      .filter((x): x is readonly [string, PuertoLibreRegistroScanFields] =>
        Boolean(x)
      )
  );
  for (const vin of knownVins) {
    const key = compactSerial(vin);
    if (!key || byVin.has(key)) continue;
    byVin.set(
      key,
      sanitizeVehiculoRowLocal({
        serialCarroceria: key,
        vin: key,
        serialMotor: "POR-COMPLETAR",
        condicion: "nuevo",
        kilometraje: "0",
        anio: anioFromVin(key)?.toString(),
      })
    );
  }
  return sanitizeFacturaMulti({
    shared: enriched.shared,
    vehiculos: [...byVin.values()],
  });
}

export async function extractBlMultiFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const parsed = await createDocumentJsonCompletion({
    prompt: BL_MULTI_PROMPT,
    buffer,
    mimeType,
    maxTokens: 3500,
    maxTextChars: 24000,
    maxPdfPages: 4,
    preferHighDetail: true,
  });

  const shared = blToFormFields(mapBl(parsed));
  let vehiculos = asRecordArray(parsed.vehiculos).map((v) => {
    const fields = blToFormFields(mapBl({ ...parsed, ...v }));
    if (!fields.condicion) fields.condicion = "nuevo";
    return fields;
  });

  if (vehiculos.length === 0) {
    const single = blToFormFields(mapBl(parsed));
    if (single.marca || single.serialCarroceria || single.modelo) {
      vehiculos.push(single);
    }
  }

  vehiculos = dedupeVehiculosBySerial(vehiculos);

  return { shared, vehiculos };
}

export async function extractCertificadoOrigenMultiFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const parsed = await createDocumentJsonCompletion({
    prompt: CERTIFICADO_ORIGEN_MULTI_PROMPT,
    buffer,
    mimeType,
    maxTokens: 4500,
    maxTextChars: 32000,
    maxPdfPages: 6,
    preferHighDetail: true,
  });

  const shared: PuertoLibreRegistroScanFields = {};
  const pais = parseString(parsed.pais_origen ?? parsed.country_of_origin);
  if (pais) shared.paisOrigen = pais;
  const marca = parseString(parsed.marca);
  if (marca) shared.marca = marca;
  const anio = parseIntSafe(parsed.anio);
  if (anio != null) shared.anio = String(anio);
  const certNo = parseString(
    parsed.numero_certificado_origen ?? parsed.certificate_no ?? parsed.coo_no
  );
  if (certNo) shared.numeroCertificadoOrigen = certNo;
  const impNombre = parseString(
    parsed.importador_nombre ?? parsed.consignee ?? parsed.importer
  );
  if (impNombre) shared.importadorNombre = impNombre;
  const impDoc = parseString(parsed.importador_documento ?? parsed.rif);
  if (impDoc) shared.importadorDocumento = impDoc;

  let vehiculos = asRecordArray(parsed.vehiculos).map((v) => {
    const fields = facturaToFormFields(
      mapFactura({
        ...parsed,
        ...v,
        serial_carroceria:
          v.serial_carroceria ?? v.vin ?? v.chasis ?? parsed.serial_carroceria,
        serial_motor: v.serial_motor ?? v.engine_number ?? parsed.serial_motor,
        pais_origen: v.pais_origen ?? parsed.pais_origen,
      })
    );
    if (certNo) {
      fields.numeroCertificadoOrigen = certNo;
    }
    if (!fields.paisOrigen && pais) fields.paisOrigen = pais;
    if (!fields.marca && marca) fields.marca = marca;
    if (!fields.anio && anio != null) fields.anio = String(anio);
    if (!fields.condicion) fields.condicion = "nuevo";
    if (fields.kilometraje == null) fields.kilometraje = "0";
    const llave = parseString(v.numero_llave ?? v.key_number);
    if (llave) {
      fields.observaciones = [`Llave ${llave}`, fields.observaciones]
        .filter(Boolean)
        .join(" · ");
    }
    return fields;
  });

  if (vehiculos.length === 0) {
    const single = facturaToFormFields(mapFactura(parsed));
    if (certNo) single.numeroCertificadoOrigen = certNo;
    if (single.marca || single.serialCarroceria || single.serialMotor || single.modelo) {
      vehiculos.push(single);
    }
  }

  vehiculos = dedupeVehiculosBySerial(vehiculos);
  return { shared, vehiculos };
}

/** Combina campos OCR: el patch no pisa valores ya rellenados (observaciones se concatenan). */
export function mergeScanFields(
  base: PuertoLibreRegistroScanFields,
  patch: PuertoLibreRegistroScanFields
): PuertoLibreRegistroScanFields {
  const out: PuertoLibreRegistroScanFields = { ...base };
  for (const [k, v] of Object.entries(patch) as [
    keyof PuertoLibreRegistroScanFields,
    PuertoLibreRegistroScanFields[keyof PuertoLibreRegistroScanFields],
  ][]) {
    if (v == null || String(v).trim() === "") continue;
    const current = out[k];
    if (k === "observaciones") {
      const a = current != null ? String(current).trim() : "";
      const b = String(v).trim();
      if (!a) out.observaciones = b;
      else if (!b || a.includes(b)) out.observaciones = a;
      else if (b.includes(a)) out.observaciones = b;
      else out.observaciones = `${a} · ${b}`;
      continue;
    }
    const currentBlank =
      current == null ||
      String(current).trim() === "" ||
      (k === "serialMotor" &&
        String(current).trim().toUpperCase() === "POR-COMPLETAR");
    if (currentBlank) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
