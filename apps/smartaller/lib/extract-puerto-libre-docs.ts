import { createDocumentJsonCompletion, getPdfPlainText } from "@/lib/ai/document-json-completion";
import { anioFromVin, rotateImageBuffer } from "@/lib/ai/image-orient";
import {
  countValidVinsInText,
  mergeFacturaMultiByVin,
  parseMavHojaAnexaFromText,
  sanitizeFacturaMulti,
  scoreFacturaMulti,
} from "@/lib/importacion/factura-row-fidelity";

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

function mapFactura(parsed: Record<string, unknown>): FacturaComercialExtraida {
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
    serial_carroceria: compactSerial(
      parseString(
        parsed.serial_carroceria ??
          parsed.vin ??
          parsed.vin_number ??
          parsed.chasis ??
          parsed.no_de_chasis ??
          parsed.numero_chasis
      )
    ),
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
  const codigo = parseString(
    v.codigo_modelo ?? v.codigo ?? v.code ?? v.model_code
  );
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

/** Campos de formulario de registro PL que se pueden rellenar desde OCR. */
export type PuertoLibreRegistroScanFields = {
  marca?: string;
  modelo?: string;
  color?: string;
  anio?: string;
  serialMotor?: string;
  vin?: string;
  serialCarroceria?: string;
  kilometraje?: string;
  condicion?: "nuevo" | "usado";
  esSubasta?: "true" | "false";
  partidaArancelaria?: string;
  cilindradaCc?: string;
  tipoCombustible?:
    | "gasolina"
    | "diesel"
    | "electrico"
    | "hibrido"
    | "gnv"
    | "otro";
  fechaLlegadaBuque?: string;
  importadorNombre?: string;
  importadorDocumento?: string;
  importadorTelefono?: string;
  importadorEmail?: string;
  importadorDireccion?: string;
  aduana?: string;
  numeroBl?: string;
  paisOrigen?: string;
  valorCif?: string;
  tasaCambioBcv?: string;
  numeroExpedienteSeniat?: string;
  numeroDav?: string;
  numeroCertificadoOrigen?: string;
  numeroListaEmpaque?: string;
  numeroPolizaTransporte?: string;
  observaciones?: string;
};

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
A) Carátula multipágina (Chery / Intercontinental): Marks and numbers | VIN | Description (color) | Qty | Unit Price | Amount.
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
- Incluye TODAS las filas (1..N). Si ves 6 unidades, vehiculos.length debe ser 6.
- Cada VIN distinto = un objeto en vehiculos. No fusiones filas.
- Si un dígito no se lee con claridad → null en ese campo (no adivines).
- Documento rotado 90°: lee igual la tabla.
- Nuevo / 0 km → condicion="nuevo", kilometraje=0.
- valor_cif unitario solo si hay precio por fila; total → valor_cif_total.

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
const FACTURA_MULTI_TABLA_PROMPT = `Transcribe ÚNICAMENTE la tabla de vehículos de esta factura / hoja anexa.
Para cada fila copia carácter a carácter: No., Chasis/VIN (17), Motor, Llave, Color, Codigo.
No inventes. No omitas filas. Si está rotada, lee igual.
Responde SOLO JSON:
{
  "numero_factura": string|null,
  "vehiculos": [
    {
      "numero_unidad": string|null,
      "serial_carroceria": string|null,
      "serial_motor": string|null,
      "numero_llave": string|null,
      "color": string|null,
      "codigo_modelo": string|null,
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
  const { color, codigo } = splitColorAndCodigo(
    parseString(v.color ?? merged.color),
    parseString(v.codigo_modelo ?? v.codigo ?? v.code)
  );
  const data = mapFactura({
    ...merged,
    modelo,
    color,
    serial_carroceria:
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
    codigo_modelo: codigo ?? v.codigo_modelo,
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
    maxTokens: 8000,
    maxTextChars: 50000,
    maxPdfPages: 8,
    preferHighDetail: true,
    // Multi-vehículo: priorizar visión fiel (evitar texto basura de escáner).
    forceRasterVision: isPdf,
    renderScale: 2.75,
  });
  return sanitizeFacturaMulti(parseFacturaMultiResult(parsed));
}

function pickBestFacturaMulti(
  candidates: DocMultiExtracted[]
): DocMultiExtracted {
  let best = candidates[0] ?? { shared: {}, vehiculos: [] };
  let bestScore = scoreFacturaMulti(best);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const s = scoreFacturaMulti(c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  // Fusionar todos por VIN para recuperar celdas faltantes.
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

  // 1) Parser determinista si hay texto con varios VIN (PDF digital o OCR embebido).
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
      // seguir con visión
    }
  }

  // 2) Pasada principal (visión / LLM).
  try {
    candidates.push(await extractFacturaMultiOnce(buffer, mimeType, FACTURA_MULTI_PROMPT));
  } catch {
    // Continuar con otras estrategias.
  }

  // 3) Segunda pasada solo-tabla si faltan filas o motores.
  const currentBest = candidates[0]
    ? pickBestFacturaMulti(candidates)
    : { shared: {}, vehiculos: [] };
  const needsRetry =
    scoreFacturaMulti(currentBest) < 20 ||
    currentBest.vehiculos.filter((v) => v.serialMotor && v.serialMotor !== "POR-COMPLETAR")
      .length < Math.max(2, Math.floor(currentBest.vehiculos.length * 0.5));

  if (needsRetry || currentBest.vehiculos.length < 2) {
    try {
      candidates.push(
        await extractFacturaMultiOnce(buffer, mimeType, FACTURA_MULTI_TABLA_PROMPT)
      );
    } catch {
      // ignore
    }
  }

  // 4) Rotaciones en fotos (hoja anexa horizontal).
  if (!isPdf) {
    let bestSoFar = pickBestFacturaMulti(
      candidates.length ? candidates : [{ shared: {}, vehiculos: [] }]
    );
    for (const deg of [90, 270, 180] as const) {
      if (scoreFacturaMulti(bestSoFar) >= 40 && bestSoFar.vehiculos.length >= 4) {
        break;
      }
      try {
        const rotated = await rotateImageBuffer(buffer, deg);
        const attempt = await extractFacturaMultiOnce(
          rotated.buffer,
          rotated.mimeType,
          FACTURA_MULTI_TABLA_PROMPT
        );
        candidates.push(attempt);
        if (scoreFacturaMulti(attempt) > scoreFacturaMulti(bestSoFar)) {
          bestSoFar = attempt;
        }
      } catch {
        // Continuar.
      }
    }
  }

  if (candidates.length === 0) {
    return { shared: {}, vehiculos: [] };
  }

  return pickBestFacturaMulti(candidates);
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
