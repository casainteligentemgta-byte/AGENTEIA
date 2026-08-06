import { createDocumentJsonCompletion } from "@/lib/ai/document-json-completion";

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

const FACTURA_PROMPT = `Analiza esta factura comercial de un vehículo importado (commercial invoice / factura de venta / proforma).
Extrae en JSON con estas claves exactas:
- marca (string)
- modelo (string)
- color (string)
- anio (number, año del vehículo)
- serial_motor (string)
- serial_carroceria (string: VIN, chasis o serial de carrocería)
- kilometraje (number, odómetro / millas o km si aparece; si es nuevo y no aparece usa 0)
- condicion ("nuevo" o "usado" según el documento; null si no se deduce)
- es_subasta (boolean si indica subasta/auction; null si no aparece)
- valor_cif (number: valor CIF, total o precio en USD si aparece)
- pais_origen (string)
- importador_nombre (string: buyer/consignee/importador si aparece)
- importador_documento (string: RIF/NIT/tax id del importador)
- importador_telefono (string)
- importador_email (string)
Si no encuentras un dato, usa null. Responde solo JSON.`;

const BL_PROMPT = `Analiza este conocimiento de embarque / Bill of Lading / BL / guía de carga de un vehículo.
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
  const modelo = parseString(v.modelo ?? v.model);
  if (modelo) return modelo;
  const codigo = parseString(v.codigo_modelo ?? v.codigo ?? v.code);
  return codigo;
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
    maxTokens: 900,
  });
  return mapFactura(parsed);
}

export async function extractBlFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<BlExtraido> {
  const parsed = await createDocumentJsonCompletion({
    prompt: BL_PROMPT,
    buffer,
    mimeType,
    maxTokens: 900,
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
  serialCarroceria?: string;
  kilometraje?: string;
  condicion?: "nuevo" | "usado";
  esSubasta?: "true" | "false";
  fechaLlegadaBuque?: string;
  importadorNombre?: string;
  importadorDocumento?: string;
  importadorTelefono?: string;
  importadorEmail?: string;
  aduana?: string;
  numeroBl?: string;
  paisOrigen?: string;
  valorCif?: string;
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
  if (data.serial_carroceria) fields.serialCarroceria = data.serial_carroceria;
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
  if (data.serial_carroceria) fields.serialCarroceria = data.serial_carroceria;
  if (data.observaciones) fields.observaciones = data.observaciones;
  return fields;
}

export function countFilledFields(fields: PuertoLibreRegistroScanFields): number {
  return Object.values(fields).filter((v) => v != null && String(v).trim() !== "").length;
}

const FACTURA_MULTI_PROMPT = `Analiza esta factura comercial / commercial invoice / HOJA ANEXA (Attached Sheet) de importación de vehículos.
Puede ser la carátula de la factura O una tabla anexa con VARIAS unidades (una fila = un vehículo).

Columnas típicas de hoja anexa (español/inglés):
- No. / No. Unidad / Unit → numero_unidad
- No. de Chasis / VIN Number / VIN → serial_carroceria (17 caracteres aprox., sin espacios)
- No. de Motor / Engine Number → serial_motor
- No. Llave / Key Number → numero_llave
- Color (puede ser código corto: WC2, SK5, M42, R4P) → color (deja el código tal cual)
- Código / Codigo / Code / model code → codigo_modelo (NO lo pongas como serial)

IMPORTANTE:
- Incluye TODAS las filas de vehículos visibles. No resumas ni omitas unidades.
- Si el documento está rotado, lee igual la tabla.
- Si solo hay carátula con 1 vehículo, "vehiculos" tendrá 1 elemento.
- marca/año/importador suelen estar en la carátula; en hoja anexa pueden ser null (está bien).
- Si la mercancía es nueva / new / 0 km, condicion = "nuevo".

Responde SOLO JSON con:
{
  "numero_factura": string|null,
  "importador_nombre": string|null,
  "importador_documento": string|null,
  "importador_telefono": string|null,
  "importador_email": string|null,
  "pais_origen": string|null,
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
  const data = mapFactura({
    ...merged,
    modelo,
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
  });
  const fields = facturaToFormFields(data);
  const obs = buildHojaAnexaObservaciones(v);
  if (obs) fields.observaciones = obs;
  if (!fields.condicion) fields.condicion = "nuevo";
  if (fields.kilometraje == null) fields.kilometraje = "0";
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
      bySerial.set(serial, { ...v, serialCarroceria: serial });
    }
  }

  return [...bySerial.values(), ...withoutSerial];
}

export async function extractFacturaMultiFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const parsed = await createDocumentJsonCompletion({
    prompt: FACTURA_MULTI_PROMPT,
    buffer,
    mimeType,
    maxTokens: 4500,
    maxTextChars: 28000,
  });

  const shared = facturaToFormFields(mapFactura(parsed));
  if (parsed.valor_cif_total != null && shared.valorCif == null) {
    const n = typeof parsed.valor_cif_total === "number"
      ? parsed.valor_cif_total
      : Number(parsed.valor_cif_total);
    if (Number.isFinite(n)) shared.valorCif = String(n);
  }
  // No poner nº factura en shared.observaciones: se concatena por vehículo abajo.
  const numeroFactura = parseString(parsed.numero_factura ?? parsed.invoice_no);
  const facturaLabel = numeroFactura ? `Factura ${numeroFactura}` : null;

  let vehiculos = asRecordArray(parsed.vehiculos).map((v) => {
    const fields = mapFacturaMultiVehiculo(parsed, v);
    fields.observaciones = [facturaLabel, fields.observaciones]
      .filter((x): x is string => Boolean(x && String(x).trim()))
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
    if (current == null || String(current).trim() === "") {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
