import {
  createDocumentJsonCompletion,
  getPdfPagePlainTexts,
  getPdfPlainText,
  PDF_RASTER_MAX_PAGES,
  PDF_VISION_MAX_PAGES,
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
  extractMarcaFromFacturaText,
  finalizeFacturaMarcaModelo,
  isPlausibleMarcaFabricante,
  mergeFacturaMultiByVin,
  normalizeMarcaFabricante,
  parseMavHojaAnexaFromText,
  resolveMarcaFromFacturaSources,
  sanitizeFacturaMulti,
  scoreFacturaMulti,
} from "@/lib/importacion/factura-row-fidelity";
import {
  extractCertificatePagePlainTextOriented,
  extractCertificatePagePlainTextWithTesseract,
  extractInvoicePlainTextWithTesseract,
  extractVinsFromOcrText,
  extractVinsWithTesseract,
  extractVinsWithTesseractOriented,
  isPlausibleOcrVin,
} from "@/lib/importacion/ocr-vin-tesseract";
import { isLlmConfigured, isModelNotFoundError } from "@/lib/ai/openai-config";
import { normalizePartida10 } from "@/lib/arancel/partida-utils";
import {
  harvestCertEnginesFromPages,
  harvestCertEnginesFromText,
  parseCertEngineNosFromText,
  scoreCertEngineHarvest,
  type CertEngineHarvest,
  type CertEnginePair,
} from "@/lib/importacion/cert-engine-text";
import {
  parseCheryInvoiceHeader,
  parseCheryInvoiceLineas,
} from "@/lib/importacion/chery-invoice-lines";
import { matchSerialKeyAmong } from "@/lib/importacion/serial-match";
import { preferCompleteVin, salvageCheryVin } from "@/lib/importacion/vin-text";
import { isGenericModelo } from "@/lib/importacion/completitud-datos";
import {
  inferCheryModelo,
  isModeloFragmentInColor,
  looksLikeCheryModelName,
  looksLikeCheryVin,
  repairCheryMarcaModelo,
} from "@/lib/importacion/chery-modelo";

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
  partida_arancelaria: string | null;
  cilindrada_cc: number | null;
  tipo_combustible: "gasolina" | "diesel" | "electrico" | "hibrido" | "gnv" | "otro" | null;
  importador_nombre: string | null;
  importador_documento: string | null;
  importador_telefono: string | null;
  importador_email: string | null;
};

export type BlExtraido = {
  numero_bl: string | null;
  fecha_llegada_buque: string | null;
  /** Puerto de descarga / place of delivery (texto libre). */
  puerto: string | null;
  /**
   * Tránsito aduanero: ninguno | transito | uso24.
   * null si el documento no lo indica con claridad.
   */
  modalidad_transito: "ninguno" | "transito" | "uso24" | null;
  /** Aduana de tránsito / destino cuando modalidad es transito o uso24. */
  aduana_transito: string | null;
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

/** Datos típicos de una póliza de transporte (marine / cargo insurance). */
export type PolizaTransporteExtraida = {
  numero_poliza: string | null;
  numero_bl: string | null;
  fecha_llegada_buque: string | null;
  puerto: string | null;
  modalidad_transito: "ninguno" | "transito" | "uso24" | null;
  aduana_transito: string | null;
  aduana: string | null;
  pais_origen: string | null;
  observaciones: string | null;
};

const FACTURA_PROMPT = `Eres un extractor de datos de FACTURAS COMERCIALES de vehículos (commercial invoice / factura de venta / proforma / factura de compra).
Lee SOLO lo que aparece escrito en el documento (texto o imagen). NO inventes ni completes de memoria.

Extrae en JSON con estas claves exactas:
- marca (string: fabricante, ej. Nissan, Chery, Toyota)
- modelo (string: línea/modelo comercial)
- color (string: color tal como aparece)
- anio (number: año del vehículo o del modelo si aparece; null si no está)
- serial_motor (string: Nº motor / ENGINE SERIAL / engine no.)
- serial_carroceria (string: VIN de 17 caracteres, chasis o serial de carrocería; prioriza VIN)
- kilometraje (number: odómetro en km o millas si aparece; si el vehículo es nuevo y no aparece usa 0)
- condicion ("nuevo" o "usado" según el documento; null si no se deduce)
- es_subasta (boolean si indica subasta/auction; null si no aparece)
- valor_cif (number: valor CIF, unit price o total en USD si aparece un solo vehículo)
- pais_origen (string)
- partida_arancelaria (string: HS / NANDINA / subpartida a 6–10 dígitos si aparece)
- cilindrada_cc (number: cilindrada en cm3 / cc si aparece)
- tipo_combustible ("gasolina"|"diesel"|"electrico"|"hibrido"|"gnv"|"otro"|null)
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

PRIORIDAD: numero_bl suele estar en la esquina SUPERIOR DERECHA de la 1ª página
(etiquetas típicas: B/L No., BL No., Bill of Lading No., Document No., Nº BL / Guía).
Léelo primero ahí; no lo confundas con container no., seal, voyage, booking interno ni VIN.

Extrae en JSON con estas claves exactas:
- numero_bl (string: B/L No., BL number, guía — obligatorio si se ve arriba a la derecha)
- fecha_llegada_buque (string YYYY-MM-DD: ETA, arrival, llegada del buque o fecha del BL si es la única)
- puerto (string: puerto de descarga / port of discharge / place of delivery; ej. El Guamache, La Guaira, Puerto Cabello)
- modalidad_transito ("ninguno" | "transito" | "uso24" | null):
  - "transito" si indica tránsito aduanero, in transit, transshipment hacia otra aduana/destino interior
  - "uso24" si menciona USO24 / USO 24 / uso temporal 24
  - "ninguno" solo si dice explícitamente destino final / sin tránsito / direct delivery al puerto de descarga
  - null si no se puede deducir
- aduana_transito (string: aduana o destino de tránsito/USO24 si aparece; null si no)
- aduana (string: aduana / customs office de destino si aparece; si solo hay puerto de descarga puedes repetir el puerto aquí)
- pais_origen (string: país de origen; si solo hay puerto de carga/loading, el país de ese puerto)
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

const POLIZA_TRANSPORTE_PROMPT = `Eres un extractor de PÓLIZAS DE TRANSPORTE / marine cargo insurance / póliza de seguro de mercancía.
Lee SOLO lo escrito en el documento. NO inventes.

Extrae en JSON con estas claves exactas:
- numero_poliza (string: Policy No., Nº póliza, certificado de seguro)
- numero_bl (string: B/L No. / BL referenciado en la póliza, si aparece)
- fecha_llegada_buque (string YYYY-MM-DD: ETA, arrival, fecha de llegada o vigencia de viaje si es la única fecha útil)
- puerto (string: puerto de descarga / destino / place of discharge)
- modalidad_transito ("ninguno" | "transito" | "uso24" | null): mismas reglas que en un BL; null si no se indica
- aduana_transito (string|null)
- aduana (string: aduana o puerto de destino si aparece)
- pais_origen (string: país o puerto de origen / loading)
- observaciones (string breve: aseguradora, buque, viaje si ayuda)
Si no encuentras un dato, usa null. Responde solo JSON.`;

function parseString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function foldFieldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Busca un campo ignorando mayúsculas, espacios y guiones (Code, ENGINE SERIAL…). */
function pickByFoldedKeys(
  parsed: Record<string, unknown>,
  aliases: string[]
): string | null {
  const byFold = new Map<string, unknown>();
  for (const [key, val] of Object.entries(parsed)) {
    const folded = foldFieldKey(key);
    if (!folded || byFold.has(folded)) continue;
    byFold.set(folded, val);
  }
  for (const alias of aliases) {
    const v = parseString(byFold.get(foldFieldKey(alias)));
    if (v) return v;
  }
  return null;
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

function parseTipoCombustible(
  value: unknown
): "gasolina" | "diesel" | "electrico" | "hibrido" | "gnv" | "otro" | null {
  const raw = parseString(value)
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!raw) return null;
  if (/elect/.test(raw)) return "electrico";
  if (/hibr/.test(raw) || /hybrid/.test(raw)) return "hibrido";
  if (/gnv|gas\s*natural|cng/.test(raw)) return "gnv";
  if (/diesel|gasoil/.test(raw)) return "diesel";
  if (/gasolina|gasoline|petrol/.test(raw)) return "gasolina";
  if (/otro|other/.test(raw)) return "otro";
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
  const salvaged = salvageCheryVin(value);
  if (salvaged) return salvaged;
  const compact = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  // OCR Chery: LWV / LVW → LVV
  if (/^LWV|^LV[WY]|^LYV|^LWW/.test(compact)) {
    return `LVV${compact.slice(3)}`;
  }
  return compact || null;
}

const SERIAL_MOTOR_FOLDED_RE =
  /^(serialmotor|engineserial(no|number|#)?|engine(no|number|nro|num)|motorserial|motor(no|number)|numeromotor|nodemotor|nmotor)$/;

/** Lee serial de motor bajo nombres ES/EN (Engine Serial, ENGINE NO, etc.). */
function pickSerialMotorRaw(parsed: Record<string, unknown>): string | null {
  const preferred = pickByFoldedKeys(parsed, [
    "serial_motor",
    "serialMotor",
    "engine_serial",
    "engineSerial",
    "engine_serial_no",
    "engine_serial_number",
    "engine serial",
    "engine serial no",
    "engine serial number",
    "engine_number",
    "engine_no",
    "engineNo",
    "ENGINE No",
    "ENGINE NO",
    "engine number",
    "engine no",
    "engine nro",
    "no_de_motor",
    "numero_motor",
    "motor_serial",
    "motorSerial",
    "serial motor",
    "motor serial",
    "motor_no",
    "motor number",
  ]);
  if (preferred) return preferred;
  for (const [key, val] of Object.entries(parsed)) {
    const collapsed = foldFieldKey(key);
    if (
      SERIAL_MOTOR_FOLDED_RE.test(collapsed) ||
      collapsed.startsWith("engineserial") ||
      collapsed.startsWith("engineno")
    ) {
      const v = parseString(val);
      if (v) return v;
    }
  }
  return null;
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
  ];
  for (const key of keys) {
    const raw = pickByFoldedKeys(v, [key]);
    if (!raw) continue;
    const compact = compactSerial(raw);
    if (compact && /^[A-HJ-NPR-Z0-9]{17}$/.test(compact)) {
      return compact;
    }
  }
  return null;
}

function looksLikeSerialNotColor(raw: string): boolean {
  const compact = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compact.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(compact)) return true;
  if (!/\s/.test(raw.trim()) && compact.length >= 8 && compact.length <= 16) {
    return /[A-Z]/i.test(compact) && /\d/.test(compact);
  }
  return false;
}

/** VIN y color a menudo van en la misma celda o en columnas vecinas (Code | Color). */
function splitVinAdjacentColor(raw: string | null): {
  vin: string | null;
  color: string | null;
} {
  if (!raw) return { vin: null, color: null };
  const trimmed = raw.trim();
  const match = trimmed.match(/^([A-HJ-NPR-Z0-9]{17})\s+(.+)$/i);
  if (match) {
    const vin = compactSerial(match[1]);
    const rest = match[2]!.trim();
    if (vin && rest && !isGenericModelo(rest) && !looksLikeSerialNotColor(rest)) {
      return { vin, color: rest };
    }
    return { vin, color: null };
  }
  const compact = compactSerial(trimmed);
  if (compact && /^[A-HJ-NPR-Z0-9]{17}$/.test(compact)) {
    return { vin: compact, color: null };
  }
  return { vin: null, color: null };
}

function isPlausibleFacturaColor(raw: string | null): boolean {
  if (!raw) return false;
  const t = raw.trim();
  if (t.length < 3 || t.length > 40) return false;
  if (isGenericModelo(t) || looksLikeSerialNotColor(t)) return false;
  if (isModeloFragmentInColor(t)) return false;
  return true;
}

/** Color: columna al lado del VIN (Description, Colour, Color). */
function pickColorRaw(parsed: Record<string, unknown>): string | null {
  const direct = pickByFoldedKeys(parsed, [
    "color",
    "colour",
    "color_name",
    "exterior_color",
    "paint",
    "paint_color",
    "description",
    "description_of_goods",
    "descriptionofgoods",
    "goods_description",
    "desc",
  ]);
  if (isPlausibleFacturaColor(direct)) return direct;
  for (const [key, val] of Object.entries(parsed)) {
    const folded = foldFieldKey(key);
    if (
      folded === "color" ||
      folded === "colour" ||
      folded.includes("descriptionofgoods") ||
      folded === "description"
    ) {
      const v = parseString(val);
      if (isPlausibleFacturaColor(v)) return v;
    }
  }
  const vinField = pickByFoldedKeys(parsed, [
    "code",
    "vin",
    "serial_carroceria",
    "chasis",
  ]);
  const split = splitVinAdjacentColor(vinField);
  return isPlausibleFacturaColor(split.color) ? split.color : null;
}

/** Año desde factura/COO (columna year/model year) o dígito 10 del VIN. */
function resolveAnioFromSources(
  parsed: Record<string, unknown>,
  vin?: string | null
): number | null {
  const direct = parseIntSafe(
    parsed.anio ??
      parsed.año ??
      parsed.year ??
      parsed.model_year ??
      parsed.modelYear ??
      parsed.manufacture_year ??
      parsed.manufacturing_year ??
      parsed.yom
  );
  const maxYear = new Date().getFullYear() + 2;
  if (direct != null && direct >= 1950 && direct <= maxYear) return direct;
  return anioFromVin(vin ?? null);
}

function mapFactura(parsed: Record<string, unknown>): FacturaComercialExtraida {
  const adjacent = splitVinAdjacentColor(
    pickByFoldedKeys(parsed, ["code", "vin", "serial_carroceria", "chasis"])
  );
  const vinFromCode = resolveVinCandidate(parsed) ?? adjacent.vin;
  const serial_carroceria =
    compactSerial(
      parseString(
        parsed.serial_carroceria ??
          parsed.vin ??
          parsed.vin_number ??
          parsed.chasis ??
          parsed.no_de_chasis ??
          parsed.numero_chasis
      )
    ) ?? vinFromCode;
  return {
    marca: parseString(parsed.marca),
    modelo: parseString(parsed.modelo),
    color: pickColorRaw(parsed) ?? adjacent.color,
    anio: resolveAnioFromSources(parsed, serial_carroceria),
    serial_motor: compactSerial(pickSerialMotorRaw(parsed)),
    serial_carroceria,
    kilometraje: parseIntSafe(parsed.kilometraje ?? parsed.odometro ?? parsed.odometer),
    condicion: parseCondicion(parsed.condicion ?? parsed.condition),
    es_subasta: parseBool(parsed.es_subasta ?? parsed.subasta ?? parsed.auction),
    valor_cif: parseNumber(parsed.valor_cif ?? parsed.cif ?? parsed.total ?? parsed.precio),
    pais_origen: parseString(parsed.pais_origen ?? parsed.country_of_origin),
    partida_arancelaria: parseString(
      parsed.partida_arancelaria ?? parsed.hs_code ?? parsed.nandina
    ),
    cilindrada_cc: parseIntSafe(parsed.cilindrada_cc ?? parsed.cc ?? parsed.cilindrada),
    tipo_combustible: parseTipoCombustible(
      parsed.tipo_combustible ?? parsed.combustible ?? parsed.fuel
    ),
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

function parseModalidadTransito(
  value: unknown
): "ninguno" | "transito" | "uso24" | null {
  if (typeof value === "boolean") {
    return value ? "transito" : "ninguno";
  }
  const raw = parseString(value)?.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!raw) return null;
  if (
    raw === "uso24" ||
    raw === "uso_24" ||
    /uso\s*24|uso24/.test(raw)
  ) {
    return "uso24";
  }
  if (
    raw === "transito" ||
    raw === "transit" ||
    /transito|in\s*transit|transshipment|transbordo/.test(raw)
  ) {
    return "transito";
  }
  if (
    raw === "ninguno" ||
    raw === "none" ||
    raw === "no" ||
    /sin\s*transito|destino\s*final|direct\s*delivery|no\s*transit/.test(raw)
  ) {
    return "ninguno";
  }
  return null;
}

function mapBl(parsed: Record<string, unknown>): BlExtraido {
  const puerto = parseString(
    parsed.puerto ??
      parsed.port_of_discharge ??
      parsed.place_of_delivery ??
      parsed.puerto_destino
  );
  const aduana =
    parseString(parsed.aduana ?? parsed.customs_office ?? parsed.destino) ??
    // Compat: prompts antiguos metían el puerto en aduana.
    (puerto ? null : parseString(parsed.port_of_discharge));
  return {
    numero_bl:
      parseString(parsed.numero_bl ?? parsed.bl ?? parsed.bill_of_lading)?.toUpperCase() ??
      null,
    fecha_llegada_buque: parseFechaIso(
      parsed.fecha_llegada_buque ?? parsed.eta ?? parsed.arrival_date
    ),
    puerto,
    modalidad_transito: parseModalidadTransito(
      parsed.modalidad_transito ??
        parsed.transito ??
        parsed.in_transit ??
        parsed.hara_transito
    ),
    aduana_transito: parseString(
      parsed.aduana_transito ??
        parsed.aduana_destino_transito ??
        parsed.transit_customs
    ),
    aduana: aduana ?? puerto,
    pais_origen: parseString(
      parsed.pais_origen ?? parsed.country_of_origin ?? parsed.port_of_loading
    ),
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

function mapPolizaTransporte(
  parsed: Record<string, unknown>
): PolizaTransporteExtraida {
  const puerto = parseString(
    parsed.puerto ??
      parsed.port_of_discharge ??
      parsed.place_of_delivery ??
      parsed.puerto_destino
  );
  return {
    numero_poliza:
      parseString(
        parsed.numero_poliza ??
          parsed.policy_no ??
          parsed.policy_number ??
          parsed.numero_poliza_transporte
      )?.toUpperCase() ?? null,
    numero_bl:
      parseString(parsed.numero_bl ?? parsed.bl ?? parsed.bill_of_lading)?.toUpperCase() ??
      null,
    fecha_llegada_buque: parseFechaIso(
      parsed.fecha_llegada_buque ?? parsed.eta ?? parsed.arrival_date
    ),
    puerto,
    modalidad_transito: parseModalidadTransito(
      parsed.modalidad_transito ?? parsed.transito ?? parsed.in_transit
    ),
    aduana_transito: parseString(parsed.aduana_transito ?? parsed.transit_customs),
    aduana:
      parseString(parsed.aduana ?? parsed.customs_office ?? parsed.destino) ?? puerto,
    pais_origen: parseString(
      parsed.pais_origen ?? parsed.country_of_origin ?? parsed.port_of_loading
    ),
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
    maxPdfPages: PDF_VISION_MAX_PAGES,
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
      maxPdfPages: PDF_VISION_MAX_PAGES,
      preferHighDetail: true,
      forceRasterVision: true,
    });
    mapped = mapFactura(retry);
  }

  return mapped;
}

function normalizeNumeroBlCandidate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^[:#.\-]+/, "");
  if (v.length < 5 || v.length > 40) return null;
  // Evitar confundir VIN / contenedores típicos ISO.
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return null;
  if (/^[A-Z]{4}\d{7}$/.test(v)) return null;
  if (!/[A-Z0-9]/.test(v)) return null;
  return v;
}

/** Heurística sobre texto embebido del PDF (B/L No. arriba). */
function harvestNumeroBlFromText(text: string): string | null {
  if (!text.trim()) return null;
  const patterns = [
    /(?:B\s*\/\s*L|BL|BILL\s+OF\s+LADING)\s*(?:NO\.?|NUMBER|#|N[º°O]\.?)?\s*[:#.]?\s*([A-Z0-9][A-Z0-9/\-]{4,32})/i,
    /(?:N[º°O]\.?\s*(?:DE\s+)?(?:BL|GU[IÍ]A)|DOCUMENT\s+NO\.?)\s*[:#.]?\s*([A-Z0-9][A-Z0-9/\-]{4,32})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const candidate = normalizeNumeroBlCandidate(m?.[1]);
    if (candidate) return candidate;
  }
  return null;
}

/**
 * Si el OCR general no trajo numero_bl: texto PDF → crop superior derecho → visión forzada.
 */
async function resolveNumeroBlFromDocument(
  buffer: Buffer,
  mimeType: string,
  current: string | null | undefined
): Promise<string | null> {
  const already = normalizeNumeroBlCandidate(current);
  if (already) return already;

  const isPdf = mimeType.toLowerCase().includes("pdf");
  if (isPdf) {
    try {
      const fromText = harvestNumeroBlFromText(await getPdfPlainText(buffer));
      if (fromText) return fromText;
    } catch {
      // ignore
    }
  }

  try {
    let pageBuf = buffer;
    let pageMime: string = mimeType;
    if (isPdf) {
      const pages = await renderPdfPagesAsPng(buffer, {
        maxPages: 1,
        scale: 2.4,
      });
      if (pages[0]) {
        pageBuf = pages[0];
        pageMime = "image/png";
      }
    }
    // Esquina superior derecha (cabecera del BL).
    const cropped = await cropImageBuffer(pageBuf, {
      x: 0.42,
      y: 0,
      w: 0.56,
      h: 0.34,
    });
    const parsed = await createDocumentJsonCompletion({
      prompt: BL_NUMERO_HEADER_PROMPT,
      buffer: cropped.buffer,
      mimeType: cropped.mimeType,
      maxTokens: 200,
      preferHighDetail: true,
    });
    const fromCrop = normalizeNumeroBlCandidate(
      parseString(parsed.numero_bl ?? parsed.bl ?? parsed.bill_of_lading)
    );
    if (fromCrop) return fromCrop;
  } catch {
    // ignore
  }

  try {
    const parsed = await createDocumentJsonCompletion({
      prompt: BL_NUMERO_HEADER_PROMPT,
      buffer,
      mimeType,
      maxTokens: 200,
      maxPdfPages: 1,
      preferHighDetail: true,
      forceRasterVision: true,
    });
    return normalizeNumeroBlCandidate(
      parseString(parsed.numero_bl ?? parsed.bl ?? parsed.bill_of_lading)
    );
  } catch {
    return null;
  }
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
    maxPdfPages: PDF_VISION_MAX_PAGES,
    preferHighDetail: true,
  });
  const mapped = mapBl(parsed);
  if (!mapped.numero_bl) {
    mapped.numero_bl = await resolveNumeroBlFromDocument(
      buffer,
      mimeType,
      mapped.numero_bl
    );
  }
  return mapped;
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
  if (data.partida_arancelaria) {
        fields.partidaArancelaria =
          normalizePartida10(data.partida_arancelaria) ??
          (data.partida_arancelaria.replace(/\D/g, "") || data.partida_arancelaria);
  }
  if (data.cilindrada_cc != null) fields.cilindradaCc = String(data.cilindrada_cc);
  if (data.tipo_combustible) fields.tipoCombustible = data.tipo_combustible;
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
  // Si el modelo solo rellenó aduana con el puerto de descarga, úsalo también como puerto.
  if (data.puerto) fields.puerto = data.puerto;
  else if (data.aduana) fields.puerto = data.aduana;
  if (data.modalidad_transito) fields.modalidadTransito = data.modalidad_transito;
  if (data.aduana_transito) fields.aduanaTransito = data.aduana_transito;
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

export function polizaToFormFields(
  data: PolizaTransporteExtraida
): PuertoLibreRegistroScanFields {
  const fields: PuertoLibreRegistroScanFields = {};
  if (data.numero_poliza) fields.numeroPolizaTransporte = data.numero_poliza;
  if (data.numero_bl) fields.numeroBl = data.numero_bl;
  if (data.fecha_llegada_buque) fields.fechaLlegadaBuque = data.fecha_llegada_buque;
  if (data.puerto) fields.puerto = data.puerto;
  else if (data.aduana) fields.puerto = data.aduana;
  if (data.modalidad_transito) fields.modalidadTransito = data.modalidad_transito;
  if (data.aduana_transito) fields.aduanaTransito = data.aduana_transito;
  if (data.aduana) fields.aduana = data.aduana;
  if (data.pais_origen) fields.paisOrigen = data.pais_origen;
  if (data.observaciones) fields.observaciones = data.observaciones;
  return fields;
}

export async function extractPolizaTransporteFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<PolizaTransporteExtraida> {
  const parsed = await createDocumentJsonCompletion({
    prompt: POLIZA_TRANSPORTE_PROMPT,
    buffer,
    mimeType,
    maxTokens: 1200,
    maxPdfPages: PDF_VISION_MAX_PAGES,
    preferHighDetail: true,
  });
  return mapPolizaTransporte(parsed);
}

export function countFilledFields(fields: PuertoLibreRegistroScanFields): number {
  return Object.values(fields).filter((v) => v != null && String(v).trim() !== "").length;
}

const FACTURA_MULTI_PROMPT = `Eres un transcriptor fiel de FACTURAS COMERCIALES de vehículos (commercial invoice / hoja anexa / attached sheet).
REGLA DE ORO: copia SOLO lo escrito en el documento. NO inventes, NO completes de memoria, NO “arregles” seriales.

Puede ser:
A) Carátula multipágina Chery / Intercontinental: Marks and numbers | Code | Description | Qty | Unit Price | Amount.
   - MARCA (fabricante): solo del MEMBRETE / cabecera (ej. «CHERY AUTOMOBILE CO., LTD») → campo raíz "marca".
   - "Marks and numbers" = MODELO (ej. ARRIZO 5 PRO, TIGGO 7) → vehiculos[].modelo. NO es marca.
   - vehiculos[].marca = null en tablas Chery (la marca va en shared.marca del membrete).
   - "Code" / "CODE" = VIN de 17 caracteres (ej. LVVDC21B5VD713650). Cópialo a serial_carroceria y a vin. NO es un código de fábrica corto.
   - "ENGINE SERIAL" / "Engine Serial" / "ENGINE No" / "ENGINE NO" / "Engine No." = serial_motor (no es VIN).
   - El COLOR está en la columna pegada al VIN/Code (Description / Colour / Color). Ej. NASDAQ SILVER. No uses PASSENGER CAR como color.
   - Cada fila con Qty=1 es UN vehículo. Si hay 15–20 filas, vehiculos.length debe ser 15–20.
B) HOJA ANEXA / Attached Sheet (MAV TRADE): No. | No. de Chasis (VIN) | No. de Motor | No. Llave | Color | Codigo.

FORMATO B — ejemplo de fila EXACTA a transcribir:
  00001 | MF3PB8121TJ219731 | G4FLTQ622505 | M0433 | WC2 NNB | SB29AI7W5D661VDD41I
- numero_unidad = "00001"
- serial_carroceria = VIN de 17 caracteres EXACTO (sin espacios)
- serial_motor = motor EXACTO desde columna ENGINE SERIAL / ENGINE NO / serial motor (ej. G4FLTQ622505)
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

/** Una sola pasada: factura de 1 vehículo o tabla multi. */
const FACTURA_RAPIDA_PROMPT = `Extrae datos de una FACTURA DE COMPRA / commercial invoice de vehículo(s).
Copia SOLO lo escrito. No inventes VIN ni motor.

- Si hay UNA unidad: rellena marca (solo membrete/cabecera), modelo, color, anio, serial_motor, serial_carroceria (VIN de 17), valor_cif, pais_origen, importador_nombre, importador_documento, y el mismo vehículo en vehiculos[0].
- Si hay VARIAS unidades (tabla Chery Marks and numbers / Code, hoja anexa MAV): un objeto por VIN en vehiculos; modelo desde Marks and numbers, marca solo en raíz si está en membrete.
- VIN = 17 caracteres. Code de fábrica corto NO es VIN.
- El consignatario / buyer NO es la marca. Marks and numbers NO es marca.

JSON:
{
  "marca": string|null,
  "modelo": string|null,
  "color": string|null,
  "anio": number|null,
  "serial_motor": string|null,
  "serial_carroceria": string|null,
  "valor_cif": number|null,
  "pais_origen": string|null,
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
      "valor_cif": number|null
    }
  ]
}`;

/** Segunda pasada: solo tabla, máxima fidelidad de celdas. */
const FACTURA_MULTI_TABLA_PROMPT = `Transcribe ÚNICAMENTE la tabla de vehículos de esta factura / hoja anexa / commercial invoice.
Chery / Intercontinental: Marks and numbers = modelo (NO marca), Code = VIN (17), columna al lado del VIN = color, ENGINE No / Engine Serial = serial_motor, Unit Price = valor. marca=null en filas.
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
Facturas multi suelen traer varias unidades (p. ej. 8 vehículos): vehiculos.length debe coincidir con todas las filas visibles.
También anota modelo, el color que está al lado del VIN, y serial_motor si ves ENGINE No / Engine Serial.
NO omitas filas del medio ni del final. Si hay 8 VIN, vehiculos.length debe ser 8; si hay 18, debe ser 18.
Responde SOLO JSON:
{
  "vehiculos": [
    {
      "modelo": string|null,
      "color": string|null,
      "serial_carroceria": string|null,
      "serial_motor": string|null,
      "valor_cif": number|null,
      "condicion": "nuevo",
      "kilometraje": 0
    }
  ]
}`;

const BL_MULTI_PROMPT = `Analiza este Bill of Lading / BL / conocimiento de embarque (puede listar UNO o VARIOS vehículos / VINs).
Incluye TODOS los VIN o chasis listados en "vehiculos".

PRIORIDAD ABSOLUTA: "numero_bl" está casi siempre en la esquina SUPERIOR DERECHA de la 1ª página
(B/L No., BL No., Bill of Lading No., Document No., Nº BL). Léelo ahí primero.
NO uses como numero_bl: container number, seal, voyage, booking genérico, ni VIN/chasis.

Responde SOLO JSON con:
{
  "numero_bl": string|null,
  "fecha_llegada_buque": string|null,
  "puerto": string|null,
  "modalidad_transito": "ninguno"|"transito"|"uso24"|null,
  "aduana_transito": string|null,
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
puerto = port of discharge / place of delivery.
modalidad_transito: "transito" si hay tránsito/transshipment; "uso24" si menciona USO24; "ninguno" solo si dice destino final/sin tránsito; null si no se deduce.
aduana = aduana SENIAT o, si no hay, el puerto de descarga.
pais_origen = país (o país del puerto de carga).
Si la descripción es genérica sin VIN, "vehiculos" puede ser [].`;

/** Pasada enfocada: solo nº BL en cabecera superior derecha. */
const BL_NUMERO_HEADER_PROMPT = `Lee SOLO la esquina SUPERIOR DERECHA de este Bill of Lading / conocimiento de embarque.
El número de BL / B/L No. / Bill of Lading No. / Document No. / Nº BL o Guía suele estar ahí.
Responde SOLO JSON: { "numero_bl": string|null }
NO uses container no., seal, voyage, VIN ni motor. Si no se ve claro, null.`;

const CERTIFICADO_ORIGEN_MULTI_PROMPT = `Analiza este CERTIFICADO DE ORIGEN / Certificate of Origin (COO) de vehículos importados.
Puede listar UNO o VARIOS vehículos (tabla o lista de chasis/VIN/motor).
También puede ser un PDF con VARIOS certificados (uno por unidad / página).

Extrae datos que suelen faltar en la factura comercial:
- serial_motor / ENGINE SERIAL / ENGINE NO / engine number / serial motor (columna del motor)
- marca (fabricante en membrete del certificado; NO confundir con modelo Tiggo/Arrizo)
- modelo, color, anio (año / year / model year del vehículo)
- serial_carroceria / VIN / chasis
- país de origen (country of origin)
- número del certificado (Certificate No. / COO No. / Nº certificado)

IMPORTANTE:
- Incluye TODAS las unidades visibles. No omitas filas.
- Si hay una sola unidad sin tabla, "vehiculos" tendrá 1 elemento.
- Si el PDF trae varios certificados (distinto Nº por unidad), pon el número de CADA unidad en vehiculos[].numero_certificado_origen.
- Si un solo certificado cubre todas las unidades, rellena "numero_certificado_origen" de cabecera y puedes repetirlo en cada vehículo.
- serial_motor SOLO de la columna ENGINE No / ENGINE NO / Engine Serial. Está en la PÁGINA 2 (segunda imagen). La página 1 es carátula y NO trae ENGINE No. Lee la página 2 y empareja cada motor con su VIN. No lo saques de la factura comercial.
- No inventes seriales ni números de certificado. Si no se lee, null.

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
      "numero_certificado_origen": string|null,
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
  /** Pares VIN ↔ ENGINE No de la página 2 (para cruzar con la factura). */
  enginePairs?: CertEnginePair[];
  /** Columna ENGINE No en orden de fila. */
  engineNos?: string[];
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
  const adjacent = splitVinAdjacentColor(
    pickByFoldedKeys(v, ["code", "vin", "serial_carroceria", "chasis"]) ??
      pickByFoldedKeys(merged, ["code", "vin", "serial_carroceria", "chasis"])
  );
  const { color, codigo } = splitColorAndCodigo(
    pickColorRaw(v) ??
      pickColorRaw(merged) ??
      adjacent.color ??
      parseString(v.color ?? merged.color),
    codigoEsVin ? null : codigoRaw
  );
  const data = mapFactura({
    ...merged,
    modelo,
    color,
    // No heredar marca de fila si es modelo comercial (Marks and numbers).
    marca: isPlausibleMarcaFabricante(parseString(v.marca ?? merged.marca))
      ? parseString(v.marca ?? merged.marca)
      : parseString(sharedParsed.marca),
    serial_carroceria:
      vin ??
      v.serial_carroceria ??
      v.vin ??
      v.vin_number ??
      v.chasis ??
      v.no_de_chasis ??
      null,
    serial_motor: pickSerialMotorRaw(v) ?? pickSerialMotorRaw(merged),
    // CIF unitario de la fila; no heredar total de cabecera.
    valor_cif: v.valor_cif ?? v.unit_price ?? v.amount ?? null,
  });
  const fields = facturaToFormFields(data);
  const headerMarca = resolveMarcaFromFacturaSources(
    parseString(sharedParsed.marca),
    isPlausibleMarcaFabricante(fields.marca) ? fields.marca : null,
    undefined,
    vin ?? fields.serialCarroceria ?? fields.vin
  );
  if (headerMarca) {
    fields.marca = headerMarca;
  } else if (fields.marca && !isPlausibleMarcaFabricante(fields.marca)) {
    if (looksLikeCheryModelName(fields.marca) && !fields.modelo?.trim()) {
      fields.modelo =
        inferCheryModelo(fields.marca, modelo || null) || fields.marca;
    }
  }
  if (
    looksLikeCheryVin(fields.serialCarroceria || fields.vin) ||
    looksLikeCheryModelName(fields.marca) ||
    /^cherr?y$/i.test(fields.marca ?? "")
  ) {
    const fixed = repairCheryMarcaModelo(fields.marca, fields.modelo);
    fields.marca = fixed.marca || "Chery";
    fields.modelo =
      inferCheryModelo(
        fixed.modelo,
        isModeloFragmentInColor(color) ? color : null
      ) ||
      fixed.modelo ||
      fields.modelo;
  }
  if (!fields.marca) {
    const marcaShared = normalizeMarcaFabricante(parseString(sharedParsed.marca));
    if (marcaShared) fields.marca = marcaShared;
  }
  if (!fields.anio) {
    const y = resolveAnioFromSources(
      merged,
      fields.serialCarroceria || fields.vin
    );
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
  if (shared.marca && !isPlausibleMarcaFabricante(shared.marca)) {
    delete shared.marca;
  }

  const headerMarca = resolveMarcaFromFacturaSources(
    shared.marca,
    null,
    undefined,
    undefined
  );
  if (headerMarca) shared.marca = headerMarca;

  const numeroFactura = parseString(parsed.numero_factura ?? parsed.invoice_no);
  const facturaLabel = numeroFactura ? `Factura ${numeroFactura}` : null;
  const cifTotal = parseNumber(parsed.valor_cif_total);

  let vehiculos = asRecordArray(parsed.vehiculos).map((v) => {
    const fields = mapFacturaMultiVehiculo(parsed, v);
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
  const finalized = finalizeFacturaMarcaModelo(shared, vehiculos);
  return { shared: finalized.shared, vehiculos: finalized.vehiculos };
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
  if (
    !next.marca?.trim() &&
    vin &&
    /^LVV|^LVT|^LVD/.test(vin)
  ) {
    next.marca = "Chery";
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
    maxPdfPages: PDF_VISION_MAX_PAGES,
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

function localExtractHasData(doc: DocMultiExtracted): boolean {
  return doc.vehiculos.length > 0 || countFilledFields(doc.shared) > 0;
}

function docFromLocalVins(vins: string[]): DocMultiExtracted {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of vins) {
    const vin = compactSerial(raw)?.toUpperCase() ?? "";
    if (vin.length !== 17 || !isPlausibleOcrVin(vin) || seen.has(vin)) continue;
    seen.add(vin);
    unique.push(vin);
  }
  const looksChery = unique.some(
    (v) => v.startsWith("LVV") || v.startsWith("LVT") || v.startsWith("LVD")
  );
  return sanitizeFacturaMulti({
    shared: looksChery ? { marca: "Chery" } : {},
    vehiculos: unique.map((vin) =>
      sanitizeVehiculoRowLocal({
        serialCarroceria: vin,
        vin,
        serialMotor: "POR-COMPLETAR",
        condicion: "nuevo",
        kilometraje: "0",
        anio: anioFromVin(vin)?.toString(),
        ...(looksChery ? { marca: "Chery" } : {}),
      })
    ),
  });
}

function docFromCheryPlainText(plain: string): DocMultiExtracted | null {
  const lineas = parseCheryInvoiceLineas(plain);
  const vins =
    lineas.length > 0
      ? lineas.map((r) => r.vin)
      : extractVinsFromOcrText(plain).filter((v) => /^LVV|^LVT|^LVD/.test(v));
  if (vins.length === 0) return null;
  const marca = extractMarcaFromFacturaText(plain) ?? "Chery";
  const extra = new Map(lineas.map((r) => [r.vin, r]));
  return sanitizeFacturaMulti(
    {
      shared: { marca },
      vehiculos: vins.map((vin) => {
        const row = extra.get(vin);
        return sanitizeVehiculoRowLocal({
          serialCarroceria: vin,
          vin,
          marca,
          modelo: row?.modelo ?? undefined,
          color: row?.color ?? undefined,
          serialMotor: "POR-COMPLETAR",
          condicion: "nuevo",
          kilometraje: "0",
          anio: anioFromVin(vin)?.toString(),
        });
      }),
    },
    plain
  );
}

function extractFacturaFromPlainText(plain: string): DocMultiExtracted {
  const chery = docFromCheryPlainText(plain);
  if (chery && chery.vehiculos.length >= 1) {
    return chery;
  }
  const marcaHeader = extractMarcaFromFacturaText(plain);
  const mav = parseMavHojaAnexaFromText(plain);
  if (mav && mav.vehiculos.length >= 1) {
    const doc = marcaHeader
      ? { ...mav, shared: { ...mav.shared, marca: marcaHeader } }
      : mav;
    return sanitizeFacturaMulti(doc, plain);
  }
  const vins = extractVinsFromOcrText(plain);
  if (vins.length >= 1 || countValidVinsInText(plain) >= 1) {
    const doc = docFromLocalVins(vins.length >= 1 ? vins : extractVinsFromOcrText(plain));
    if (marcaHeader && !doc.shared.marca) {
      return sanitizeFacturaMulti({ ...doc, shared: { ...doc.shared, marca: marcaHeader } }, plain);
    }
    return sanitizeFacturaMulti(doc, plain);
  }
  if (marcaHeader) {
    return sanitizeFacturaMulti({ shared: { marca: marcaHeader }, vehiculos: [] }, plain);
  }
  return { shared: {}, vehiculos: [] };
}

/** Tesseract / texto PDF: VIN sin créditos de OpenRouter. */
async function extractFacturaLocalFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  try {
    const pages = isPdf
      ? await renderPdfPagesAsPng(buffer, {
          maxPages: PDF_RASTER_MAX_PAGES,
          scale: 2.2,
        })
      : [buffer];
    if (pages.length === 0) return { shared: {}, vehiculos: [] };
    const layoutText = pages[0]
      ? await extractInvoicePlainTextWithTesseract(pages[0])
      : "";
    const chery = layoutText ? docFromCheryPlainText(layoutText) : null;
    if (chery && chery.vehiculos.length >= 1) return chery;
    const tess = isPdf
      ? await extractVinsWithTesseract(pages)
      : await extractVinsWithTesseractOriented(pages[0]!);
    const combined = [layoutText, tess.fullText].filter(Boolean).join("\n");
    const mav = parseMavHojaAnexaFromText(combined);
    if (mav && mav.vehiculos.length >= 1) {
      return sanitizeFacturaMulti(mav, combined);
    }
    if (tess.vins.length >= 1) {
      return sanitizeFacturaMulti(docFromLocalVins(tess.vins), combined);
    }
  } catch {
    // vacío
  }
  return { shared: {}, vehiculos: [] };
}

/**
 * OCR de factura para el alta. Texto PDF → IA (si hay créditos) → Tesseract.
 */
export async function extractFacturaRapidoFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  let fromText: DocMultiExtracted = { shared: {}, vehiculos: [] };

  if (isPdf) {
    try {
      fromText = extractFacturaFromPlainText(await getPdfPlainText(buffer));
    } catch {
      // visión / tesseract
    }
  }

  if (localExtractHasData(fromText) && !isLlmConfigured()) {
    return fromText;
  }

  let llmError: unknown = null;
  if (isLlmConfigured()) {
    try {
      const parsed = await createDocumentJsonCompletion({
        prompt: FACTURA_RAPIDA_PROMPT,
        buffer,
        mimeType,
        maxTokens: 3500,
        maxTextChars: 50000,
        maxPdfPages: PDF_VISION_MAX_PAGES,
        preferHighDetail: true,
        renderScale: 2.2,
      });
      const extracted = enrichWithSalvagedVins(
        sanitizeFacturaMulti(parseFacturaMultiResult(parsed)),
        parsed
      );
      if (localExtractHasData(fromText) && localExtractHasData(extracted)) {
        return pickBestFacturaMulti([fromText, extracted]);
      }
      if (localExtractHasData(extracted)) return extracted;
    } catch (err) {
      llmError = err;
    }
  }

  if (localExtractHasData(fromText)) return fromText;

  const fromTess = await extractFacturaLocalFromDocument(buffer, mimeType);
  if (localExtractHasData(fromTess)) return fromTess;

  if (llmError) throw llmError;
  return { shared: {}, vehiculos: [] };
}

export async function extractFacturaMultiFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const candidates: DocMultiExtracted[] = [];
  let facturaPlainText: string | null = null;

  // 1) Texto embebido (PDF digital).
  if (isPdf) {
    try {
      const plain = await getPdfPlainText(buffer);
      facturaPlainText = plain;
      const chery = docFromCheryPlainText(plain);
      if (chery && chery.vehiculos.length >= 1) {
        candidates.push(chery);
      }
      const marcaHeader = extractMarcaFromFacturaText(plain);
      if (countValidVinsInText(plain) >= 2) {
        const deterministic = parseMavHojaAnexaFromText(plain);
        if (deterministic && deterministic.vehiculos.length >= 2) {
          const doc = marcaHeader
            ? { ...deterministic, shared: { ...deterministic.shared, marca: marcaHeader } }
            : deterministic;
          candidates.push(sanitizeFacturaMulti(doc, plain));
        }
      }
    } catch {
      // visión
    }
  }

  // 2) Visión de todas las páginas (una llamada) si el texto no cubrió el lote.
  let currentBest = candidates.length
    ? pickBestFacturaMulti(candidates)
    : { shared: {}, vehiculos: [] };

  if (currentBest.vehiculos.length < 8) {
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

  // 3) Cosecha extra por páginas si sigue corto.
  if (isPdf && currentBest.vehiculos.length < 8) {
    try {
      const pages = await renderPdfPagesAsPng(buffer, {
        maxPages: PDF_RASTER_MAX_PAGES,
        scale: 2.4,
      });
      if (pages.length > 0) {
        try {
          const layoutText = await extractInvoicePlainTextWithTesseract(pages[0]!);
          facturaPlainText = [facturaPlainText, layoutText].filter(Boolean).join("\n");
          const fromLayout = docFromCheryPlainText(layoutText);
          if (fromLayout && fromLayout.vehiculos.length > 0) {
            candidates.push(fromLayout);
          }
          const tess = await extractVinsWithTesseract(pages);
          const chery = docFromCheryPlainText(
            [layoutText, tess.fullText].filter(Boolean).join("\n")
          );
          if (chery && chery.vehiculos.length > 0) candidates.push(chery);
          if (tess.vins.length > 0) candidates.push(docFromLocalVins(tess.vins));
        } catch {
          // ignore
        }
        for (let i = 0; i < Math.min(pages.length, 3); i++) {
          if (pickBestFacturaMulti(candidates).vehiculos.length >= 8) break;
          try {
            candidates.push(
              await extractFacturaMultiFromImage(
                pages[i]!,
                "image/png",
                FACTURA_MULTI_VIN_HARVEST_PROMPT
              )
            );
          } catch {
            // ignore
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

  const best = pickBestFacturaMulti(candidates);
  return sanitizeFacturaMulti(best, facturaPlainText);
}

function stampCifUnitarioOnRows(
  extracted: DocMultiExtracted,
  plainText: string
): DocMultiExtracted {
  const cif = parseCheryInvoiceHeader(plainText).cifUnitario;
  if (cif == null) return extracted;
  const cifStr = String(cif);
  return {
    shared: extracted.shared,
    vehiculos: extracted.vehiculos.map((v) => ({
      ...v,
      valorCif: v.valorCif?.trim() ? v.valorCif : cifStr,
    })),
  };
}

/**
 * Etapa 1 — cosecha de VIN (Tesseract local primero; visión solo si hace falta).
 * Si no hay VIN, lanza Error con el diagnóstico de OCR (no lo oculta).
 */
export async function extractFacturaVinsStageFromDocument(
  buffer: Buffer,
  mimeType: string
): Promise<DocMultiExtracted> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const diagnostics: string[] = [];
  const vinSet = new Set<string>();
  const mavState: { rows: DocMultiExtracted | null } = { rows: null };
  let visionCreditsBlocked = false;
  /** Umbral para dejar de gastar visión. 20 hacía raster+Tesseract hasta timeout. */
  const MULTI_VIN_TARGET = 8;
  /**
   * Presupuesto total de la etapa VIN (cliente aborta ~110s; Vercel 120s).
   * Devolver VIN parcial > quedar en 0 por timeout.
   */
  const STAGE_BUDGET_MS = 70_000;
  const startedAt = Date.now();
  const remainingMs = () => STAGE_BUDGET_MS - (Date.now() - startedAt);
  const withinBudget = (needMs: number) => remainingMs() >= needMs;

  const cheryLineasByVin = new Map<
    string,
    { modelo?: string; color?: string; serialMotor?: string; valorCif?: string }
  >();
  let invoiceTextBag = "";

  const addVins = (vins: string[], source: string) => {
    let added = 0;
    for (const v of vins) {
      const n =
        salvageCheryVin(v) ??
        (() => {
          let raw = v.replace(/[^A-HJ-NPR-Z0-9]/gi, "").toUpperCase();
          if (/^LWV|^LV[WY]|^LYV|^LWW/.test(raw)) raw = `LVV${raw.slice(3)}`;
          return raw;
        })();
      if (n.length !== 17 || vinSet.has(n)) continue;
      if (!isPlausibleOcrVin(n) && !/^MF3|^LVV|^LVT|^LVD/.test(n)) continue;
      vinSet.add(n);
      added += 1;
    }
    diagnostics.push(`${source}: +${added} (total ${vinSet.size})`);
  };

  const rememberCheryLineas = (
    text: string | null | undefined,
    source: string
  ) => {
    if (!text?.trim()) return;
    // El OCR de VIN (whitelist) destroza "CIF 11.014"; no mezclarlo en cabecera.
    if (!/tesseract-lineas/.test(source)) {
      invoiceTextBag = `${invoiceTextBag} ${text}`.trim();
    }
    const lineas = parseCheryInvoiceLineas(text);
    if (lineas.length > 0) {
    addVins(
      lineas.map((r) => r.vin),
      source
    );
    for (const r of lineas) {
      const prev = cheryLineasByVin.get(r.vin) ?? {};
      cheryLineasByVin.set(r.vin, {
        modelo: r.modelo || prev.modelo,
        color: r.color || prev.color,
        serialMotor: r.serialMotor || prev.serialMotor,
        valorCif:
          prev.valorCif ||
          (r.valorCif != null ? String(r.valorCif) : undefined),
      });
    }
    }
    for (const pair of parseCertEngineNosFromText(text)) {
      addVins([pair.vin], `${source}-engine`);
      const prev = cheryLineasByVin.get(pair.vin) ?? {};
      cheryLineasByVin.set(pair.vin, {
        ...prev,
        serialMotor: prev.serialMotor || pair.serialMotor,
      });
    }
  };

  const noteVisionError = (label: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    diagnostics.push(`${label}: ERROR ${msg.slice(0, 160)}`);
    if (
      /402|insufficient credits|purchase more/i.test(msg) ||
      isModelNotFoundError(err)
    ) {
      visionCreditsBlocked = true;
    }
  };

  const fromImageList = async (
    img: Buffer,
    imgMime: string,
    label: string,
    timeoutMs = 32_000
  ) => {
    if (visionCreditsBlocked || !isLlmConfigured()) return;
    if (!withinBudget(8_000)) {
      diagnostics.push(`${label}: omitida (presupuesto etapa)`);
      return;
    }
    try {
      const sized = await compressImageForVision(img);
      const vins = await createVisionVinListCompletion({
        imageBuffer: sized.buffer,
        mimeType: sized.mimeType,
        preferHighDetail: true,
        maxTokens: 3000,
        timeoutMs: Math.min(timeoutMs, Math.max(12_000, remainingMs() - 3_000)),
      });
      addVins(vins, label);
    } catch (err) {
      noteVisionError(label, err);
    }
  };

  const tryMavFromText = (text: string, source: string) => {
    if (!text || text.trim().length < 40) return;
    try {
      const det = parseMavHojaAnexaFromText(text);
      if (!det?.vehiculos.length) return;
      const mf3Count = det.vehiculos.filter((v) =>
        (v.serialCarroceria ?? v.vin ?? "").toUpperCase().startsWith("MF3")
      ).length;
      // Solo aceptar filas MAV reales (evita basura OCR en facturas Chery)
      if (mf3Count < 2) return;
      addVins(
        det.vehiculos
          .map((v) => v.serialCarroceria ?? v.vin ?? "")
          .filter(Boolean),
        source
      );
      if (!mavState.rows || det.vehiculos.length > mavState.rows.vehiculos.length) {
        mavState.rows = {
          shared: det.shared ?? {},
          vehiculos: det.vehiculos,
        };
      }
    } catch {
      // ignore
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
      addVins(extractVinsFromOcrText(plain), "texto-pdf-chery");
      rememberCheryLineas(plain, "texto-pdf-lineas-chery");
      tryMavFromText(plain, "parser-mav");
    } catch (err) {
      diagnostics.push(
        `texto-pdf: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`
      );
    }
  }

  // Raster + Tesseract (local) + visión acotada
  if (vinSet.size >= MULTI_VIN_TARGET) {
    diagnostics.push(
      `ocr: omitido (texto PDF ya tiene ${vinSet.size} VIN ≥${MULTI_VIN_TARGET})`
    );
  } else {
    try {
    const pages = isPdf
      ? await renderPdfPagesAsPng(buffer, {
          maxPages: PDF_RASTER_MAX_PAGES,
          scale: 2.6,
        })
      : [buffer];
    const page1 = pages[0];
    if (!page1) {
      diagnostics.push("raster: no se pudo renderizar ninguna página");
    } else {
      diagnostics.push(`raster: ok ${pages.length} página(s)`);

      try {
        const layoutText = await extractInvoicePlainTextWithTesseract(page1);
        rememberCheryLineas(layoutText, "tesseract-factura");
        addVins(extractVinsFromOcrText(layoutText), "tesseract-factura");
        diagnostics.push(
          `tesseract-factura: ${layoutText.replace(/\s+/g, " ").trim().slice(0, 90)}`
        );
      } catch (err) {
        diagnostics.push(
          `tesseract-factura: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`
        );
      }

      // Recortes: tabla completa primero (Code no siempre está en 19–35%).
      const cropSpecs = [
        { label: "tabla", region: { x: 0.04, y: 0.26, w: 0.92, h: 0.58 } },
        { label: "col-code", region: { x: 0.19, y: 0.35, w: 0.16, h: 0.52 } },
        { label: "col-code-mid", region: { x: 0.28, y: 0.32, w: 0.28, h: 0.55 } },
        { label: "col-chasis", region: { x: 0.08, y: 0.18, w: 0.28, h: 0.7 } },
      ] as const;

      const croppedBuffers: { label: string; buffer: Buffer; mimeType: string }[] =
        [];
      for (const crop of cropSpecs) {
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

      const runTesseract = async () => {
        try {
          const tabla = croppedBuffers.find((c) => c.label === "tabla")?.buffer;
          const tessImages = isPdf
            ? [tabla, ...pages].filter((b): b is Buffer => Boolean(b))
            : croppedBuffers
                .filter(
                  (c) =>
                    c.label.startsWith("col-code") ||
                    c.label.startsWith("col-chasis")
                )
                .map((c) => c.buffer);

          const tess = isPdf
            ? await extractVinsWithTesseract(
                tessImages.length > 0 ? tessImages : [page1]
              )
            : await extractVinsWithTesseractOriented(page1);

          if (!isPdf && tess.vins.length < 6 && tessImages.length > 0) {
            const extra = await extractVinsWithTesseract(tessImages);
            addVins(extra.vins, "tesseract-crops");
            rememberCheryLineas(extra.fullText, "tesseract-lineas-crops");
            tryMavFromText(extra.fullText, "tesseract-mav-crops");
          }

          addVins(tess.vins, "tesseract");
          rememberCheryLineas(tess.fullText, "tesseract-lineas-chery");
          tryMavFromText(tess.fullText, "tesseract-mav");
          if (tess.textSample) {
            diagnostics.push(
              `tesseract-sample: ${tess.textSample.slice(0, 80)}`
            );
          }
        } catch (err) {
          diagnostics.push(
            `tesseract: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`
          );
        }
      };

      const pageMime = isPdf ? "image/png" : mimeType;
      const canVision =
        isLlmConfigured() &&
        !visionCreditsBlocked &&
        vinSet.size < MULTI_VIN_TARGET;

      // Tesseract VIN (whitelist) solo si la factura completa no bastó.
      const needVinTess = vinSet.size < MULTI_VIN_TARGET;
      if (!needVinTess) {
        diagnostics.push(
          `tesseract-vin: omitido (factura completa ya tiene ${vinSet.size} VIN)`
        );
      }
      if (canVision && withinBudget(15_000)) {
        await Promise.all([
          needVinTess ? runTesseract() : Promise.resolve(),
          fromImageList(page1, pageMime, "pagina-1", 32_000),
        ]);
      } else if (needVinTess) {
        await runTesseract();
      }

      // Resto de páginas + recorte de tabla si aún faltan VIN
      if (
        vinSet.size < MULTI_VIN_TARGET &&
        isLlmConfigured() &&
        !visionCreditsBlocked &&
        withinBudget(12_000)
      ) {
        for (let i = 1; i < pages.length; i++) {
          if (vinSet.size >= MULTI_VIN_TARGET || !withinBudget(10_000)) break;
          await fromImageList(
            pages[i]!,
            pageMime,
            `pagina-${i + 1}`,
            24_000
          );
        }
        if (vinSet.size < MULTI_VIN_TARGET && withinBudget(10_000)) {
          const priority =
            croppedBuffers.find((c) => c.label === "tabla") ??
            croppedBuffers.find((c) => c.label.startsWith("col-code")) ??
            croppedBuffers.find((c) => c.label.startsWith("col-chasis"));
          if (priority) {
            await fromImageList(
              priority.buffer,
              priority.mimeType,
              priority.label,
              24_000
            );
          }
        }
      } else if (vinSet.size >= MULTI_VIN_TARGET) {
        diagnostics.push(
          `vision: omitida extra (ya hay ${vinSet.size} VIN ≥${MULTI_VIN_TARGET})`
        );
      }
    }
    } catch (err) {
    diagnostics.push(
      `raster: ERROR ${(err instanceof Error ? err.message : String(err)).slice(0, 160)}`
    );
    }
  }

  // JSON harvest solo si casi no hay VIN y aún cabe en el presupuesto
  if (
    vinSet.size < 3 &&
    isLlmConfigured() &&
    !visionCreditsBlocked &&
    withinBudget(22_000)
  ) {
    try {
      const sized = await compressImageForVision(
        isPdf
          ? (await renderPdfPagesAsPng(buffer, {
              maxPages: PDF_RASTER_MAX_PAGES,
              scale: 2.2,
            }))[0]!
          : buffer
      );
      const parsed = await createVisionJsonCompletion({
        prompt: FACTURA_MULTI_VIN_HARVEST_PROMPT,
        imageBuffer: sized.buffer,
        mimeType: sized.mimeType,
        maxTokens: 2500,
        preferHighDetail: true,
        timeoutMs: Math.min(35_000, Math.max(12_000, remainingMs() - 2_000)),
      });
      const extracted = enrichWithSalvagedVins(
        sanitizeFacturaMulti(parseFacturaMultiResult(parsed)),
        parsed
      );
      addVins(
        extracted.vehiculos.map((v) => v.serialCarroceria ?? v.vin ?? ""),
        "json-harvest"
      );
      for (const v of extracted.vehiculos) {
        const vin =
          salvageCheryVin(v.serialCarroceria ?? v.vin) ??
          compactSerial(v.serialCarroceria ?? v.vin ?? null);
        if (!vin || vin.length < 11) continue;
        const motor = v.serialMotor?.trim();
        const prev = cheryLineasByVin.get(vin) ?? {};
        cheryLineasByVin.set(vin, {
          modelo: v.modelo || prev.modelo,
          color: v.color || prev.color,
          serialMotor:
            motor && motor.toUpperCase() !== "POR-COMPLETAR"
              ? motor
              : prev.serialMotor,
        });
      }
    } catch (err) {
      noteVisionError("json-harvest", err);
    }
  } else if (vinSet.size >= 3) {
    diagnostics.push(
      `json-harvest: omitido (ya hay ${vinSet.size} VIN; datos en etapa 2)`
    );
  } else if (!withinBudget(22_000)) {
    diagnostics.push(
      `json-harvest: omitido (presupuesto ${Math.round(remainingMs() / 1000)}s)`
    );
  }

  diagnostics.push(`etapa-vin: ${Date.now() - startedAt}ms · ${vinSet.size} VIN`);

  if (vinSet.size === 0) {
    const hint = visionCreditsBlocked
      ? "La IA de visión no respondió (créditos/cuota). Revisa GEMINI_API_KEY o usa Excel."
      : "Revisa nitidez / rotación de la foto, o usa la plantilla Excel.";
    throw new Error(
      `Sin VIN legibles. ${diagnostics.slice(0, 6).join(" · ") || hint}`
    );
  }

  // Preferir filas MAV completas (motor/color/llave) si el OCR local las armó
  if (
    mavState.rows !== null &&
    mavState.rows.vehiculos.length >= Math.min(2, vinSet.size)
  ) {
    const rows = mavState.rows;
    const byVin = new Map<string, PuertoLibreRegistroScanFields>();
    for (const v of rows.vehiculos) {
      let vin = salvageCheryVin(v.serialCarroceria ?? v.vin) ??
        (v.serialCarroceria ?? v.vin ?? "").toUpperCase();
      if (/^LWV|^LV[WY]/.test(vin)) vin = `LVV${vin.slice(3)}`;
      if (vin.length !== 17 || !isPlausibleOcrVin(vin)) continue;
      const extra = cheryLineasByVin.get(vin);
      byVin.set(vin, {
        ...v,
        serialCarroceria: vin,
        vin,
        modelo: v.modelo || extra?.modelo,
        color: v.color || extra?.color,
        serialMotor:
          extra?.serialMotor ||
          (v.serialMotor?.toUpperCase() === "POR-COMPLETAR"
            ? undefined
            : v.serialMotor) ||
          "POR-COMPLETAR",
      });
    }
    for (const vin of vinSet) {
      if (!byVin.has(vin)) {
        const extra = cheryLineasByVin.get(vin);
        byVin.set(
          vin,
          sanitizeVehiculoRowLocal({
            serialCarroceria: vin,
            vin,
            serialMotor: extra?.serialMotor || "POR-COMPLETAR",
            condicion: "nuevo",
            kilometraje: "0",
            anio: anioFromVin(vin)?.toString(),
            ...(extra?.modelo ? { modelo: extra.modelo } : {}),
            ...(extra?.color ? { color: extra.color } : {}),
            ...(extra?.valorCif ? { valorCif: extra.valorCif } : {}),
          })
        );
      }
    }
    if (byVin.size > 0) {
      return stampCifUnitarioOnRows(
        sanitizeFacturaMulti(
          {
            shared: rows.shared ?? {},
            vehiculos: [...byVin.values()],
          },
          invoiceTextBag
        ),
        invoiceTextBag
      );
    }
  }

  const looksChery = [...vinSet].some(
    (v) => v.startsWith("LVV") || v.startsWith("LVT") || v.startsWith("LVD")
  );
  const looksMav = [...vinSet].some((v) => v.startsWith("MF3"));
  const vehiculos = [...vinSet].map((vin) => {
    const extra = cheryLineasByVin.get(vin);
    return sanitizeVehiculoRowLocal({
      serialCarroceria: vin,
      vin,
      serialMotor: extra?.serialMotor || "POR-COMPLETAR",
      condicion: "nuevo",
      kilometraje: "0",
      anio: anioFromVin(vin)?.toString(),
      ...(looksChery ? { marca: "Chery" } : {}),
      ...(extra?.modelo ? { modelo: extra.modelo } : {}),
      ...(extra?.color ? { color: extra.color } : {}),
      ...(extra?.valorCif ? { valorCif: extra.valorCif } : {}),
    });
  });

  return stampCifUnitarioOnRows(
    sanitizeFacturaMulti(
      {
        shared: looksChery ? { marca: "Chery" } : looksMav ? {} : {},
        vehiculos,
      },
      invoiceTextBag
    ),
    invoiceTextBag
  );
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
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const enginePairs: { vin: string; serialMotor: string }[] = [];
  let invoiceTextBag = "";

  // OCR local primero (útil con OpenRouter sin créditos)
  try {
    if (isPdf) {
      try {
        const plain = await getPdfPlainText(buffer);
        invoiceTextBag = `${invoiceTextBag} ${plain}`.trim();
        enginePairs.push(...parseCertEngineNosFromText(plain));
      } catch {
        // raster / tesseract abajo
      }
    }
    const pages = isPdf
      ? await renderPdfPagesAsPng(buffer, {
          maxPages: PDF_RASTER_MAX_PAGES,
          scale: 2.6,
        })
      : [buffer];
    if (pages[0]) {
      const layoutText = await extractInvoicePlainTextWithTesseract(pages[0]);
      invoiceTextBag = `${invoiceTextBag} ${layoutText}`.trim();
      const fromLayout = docFromCheryPlainText(layoutText);
      if (fromLayout && fromLayout.vehiculos.length > 0) {
        candidates.push(fromLayout);
      }
      const tess = isPdf
        ? await extractVinsWithTesseract(pages)
        : await extractVinsWithTesseractOriented(pages[0]!);
      invoiceTextBag = `${invoiceTextBag} ${tess.fullText}`.trim();
      enginePairs.push(...parseCertEngineNosFromText(tess.fullText));
      const mav = parseMavHojaAnexaFromText(
        [layoutText, tess.fullText].filter(Boolean).join("\n")
      );
      if (mav && mav.vehiculos.length > 0) {
        candidates.push(mav);
      }
    }
  } catch {
    // sigue a visión
  }

  if (isLlmConfigured()) {
    try {
      candidates.push(await extractFacturaMultiOnce(buffer, mimeType, prompt));
    } catch {
      // ignore
    }
  }

  if (candidates.length === 0) {
    // Devolver esqueletos por VIN conocidos
    return sanitizeFacturaMulti(
      {
        shared: {},
        vehiculos: knownVins.map((vin) => {
          const key = compactSerial(vin);
          const looksChery = /^LVV|^LVT|^LVD/.test(key ?? "");
          return sanitizeVehiculoRowLocal({
            serialCarroceria: vin,
            vin,
            serialMotor: "POR-COMPLETAR",
            condicion: "nuevo",
            kilometraje: "0",
            anio: anioFromVin(vin)?.toString(),
            ...(looksChery ? { marca: "Chery" } : {}),
          });
        }),
      },
      invoiceTextBag
    );
  }

  const picked = pickBestFacturaMulti(candidates);
  const enrichedVehiculos = applyCertEnginePairs(picked.vehiculos, enginePairs);
  // Asegurar que no se pierdan VIN de la etapa 1
  const byVin = new Map(
    enrichedVehiculos
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
        ...(/^LVV|^LVT|^LVD/.test(key) ? { marca: "Chery" } : {}),
      })
    );
  }
  return stampCifUnitarioOnRows(
    sanitizeFacturaMulti(
      {
        shared: picked.shared,
        vehiculos: [...byVin.values()],
      },
      invoiceTextBag
    ),
    invoiceTextBag
  );
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
    maxTextChars: 50000,
    maxPdfPages: PDF_VISION_MAX_PAGES,
    preferHighDetail: true,
  });

  const blMapped = mapBl(parsed);
  if (!blMapped.numero_bl) {
    blMapped.numero_bl = await resolveNumeroBlFromDocument(
      buffer,
      mimeType,
      blMapped.numero_bl
    );
  }
  const shared = blToFormFields(blMapped);
  let vehiculos = asRecordArray(parsed.vehiculos).map((v) => {
    const fields = blToFormFields(
      mapBl({ ...parsed, numero_bl: blMapped.numero_bl, ...v })
    );
    if (!fields.condicion) fields.condicion = "nuevo";
    return fields;
  });

  if (vehiculos.length === 0) {
    const single = blToFormFields(blMapped);
    if (single.marca || single.serialCarroceria || single.modelo) {
      vehiculos.push(single);
    }
  }

  vehiculos = dedupeVehiculosBySerial(vehiculos);

  return { shared, vehiculos };
}

function certVinKey(raw: string | null | undefined): string {
  return (
    salvageCheryVin(raw) ??
    (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  );
}

function applyCertEnginePairs(
  vehiculos: PuertoLibreRegistroScanFields[],
  pairs: { vin: string; serialMotor: string }[]
): PuertoLibreRegistroScanFields[] {
  if (pairs.length === 0) return vehiculos;
  const next = [...vehiculos];
  const used = new Set<number>();
  for (const pair of pairs) {
    const keys = next.map((v) => certVinKey(v.serialCarroceria ?? v.vin));
    const matchedKey = matchSerialKeyAmong(pair.vin, keys);
    const idx = matchedKey
      ? keys.findIndex((k, i) => !used.has(i) && k === matchedKey)
      : -1;
    if (idx >= 0) {
      used.add(idx);
      const row = next[idx]!;
      const current = row.serialMotor?.trim().toUpperCase() ?? "";
      if (!current || current === "POR-COMPLETAR") {
        next[idx] = { ...row, serialMotor: pair.serialMotor };
      }
      continue;
    }
    next.push(
      sanitizeVehiculoRowLocal({
        serialCarroceria: pair.vin,
        vin: pair.vin,
        serialMotor: pair.serialMotor,
        condicion: "nuevo",
        kilometraje: "0",
      })
    );
  }
  return next;
}

async function ocrPdfPageText(
  buffer: Buffer,
  pageNumber: number,
  options?: { fast?: boolean }
): Promise<string> {
  const pages = await renderPdfPagesAsPng(buffer, {
    startPage: pageNumber,
    maxPages: 1,
    scale: options?.fast ? 2.0 : 2.6,
  });
  if (!pages[0]) return "";
  if (options?.fast) {
    return extractCertificatePagePlainTextOriented(pages[0]);
  }
  return extractCertificatePagePlainTextWithTesseract(pages[0], {
    fast: options?.fast,
  });
}

function emptyCertHarvest(): CertEngineHarvest {
  return { pairs: [], motors: [] };
}

async function harvestCertEngineNos(
  buffer: Buffer,
  mimeType: string,
  options?: { rapido?: boolean }
): Promise<CertEngineHarvest> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const fast = Boolean(options?.rapido);

  let pageTexts: string[] = [];
  if (isPdf) {
    try {
      pageTexts = await getPdfPagePlainTexts(buffer);
    } catch {
      pageTexts = [];
    }
  }
  const fromEmbedded = harvestCertEnginesFromPages(pageTexts);
  if (fromEmbedded.pairs.length > 0) return fromEmbedded;
  // Pág. 2 escaneada (COO Chery): sin texto embebido. Una pasada OCR + rotación.

  if (!isPdf) {
    try {
      const ocr = await extractCertificatePagePlainTextOriented(buffer);
      return harvestCertEnginesFromText(ocr);
    } catch {
      return emptyCertHarvest();
    }
  }

  let fromOcr = emptyCertHarvest();
  try {
    const page2Ocr = await ocrPdfPageText(buffer, 2, { fast: true });
    fromOcr = harvestCertEnginesFromText(page2Ocr);
  } catch {
    fromOcr = emptyCertHarvest();
  }
  return scoreCertEngineHarvest(fromOcr) >= scoreCertEngineHarvest(fromEmbedded)
    ? fromOcr
    : fromEmbedded;
}

export async function extractCertificadoOrigenMultiFromDocument(
  buffer: Buffer,
  mimeType: string,
  options?: { rapido?: boolean }
): Promise<DocMultiExtracted> {
  const isPdf = mimeType.toLowerCase().includes("pdf");
  const harvest = await harvestCertEngineNos(buffer, mimeType, {
    rapido: options?.rapido,
  });
  const enginesFromText = harvest.pairs;
  const skipLlmForEngines =
    Boolean(options?.rapido) ||
    harvest.pairs.length >= 2 ||
    harvest.motors.length >= 2;

  let parsed: Record<string, unknown> = {};
  let llmError: unknown = null;
  if (isLlmConfigured() && !skipLlmForEngines) {
    try {
      parsed = await createDocumentJsonCompletion({
        prompt: CERTIFICADO_ORIGEN_MULTI_PROMPT,
        buffer,
        mimeType,
        maxTokens: options?.rapido ? 3500 : 4500,
        maxTextChars: 32000,
        // Página 2 = ENGINE No; no quedarse en texto de la carátula.
        maxPdfPages: PDF_VISION_MAX_PAGES,
        preferHighDetail: true,
        forceRasterVision: isPdf && harvest.pairs.length === 0,
      });
    } catch (err) {
      llmError = err;
    }

    // Reintento: si el PDF es escaneado y el primer parse casi no detectó
    // seriales/motor (los campos quedan null), fuerza raster+visión.
    if (isPdf && !llmError && harvest.pairs.length === 0) {
      const vehiculosRaw = asRecordArray((parsed as Record<string, unknown>).vehiculos);
      const hasCritical = vehiculosRaw.some((v) => {
        const vinOrChassis = parseString(
          (v as Record<string, unknown>).serial_carroceria ??
            (v as Record<string, unknown>).vin ??
            (v as Record<string, unknown>).chasis ??
            (v as Record<string, unknown>).code
        );
        const motor = pickSerialMotorRaw(v as Record<string, unknown>);
        return Boolean(vinOrChassis || motor);
      });
      const hasMotor =
        harvest.pairs.length > 0 ||
        harvest.motors.length > 0 ||
        vehiculosRaw.some((v) =>
          Boolean(pickSerialMotorRaw(v as Record<string, unknown>))
        );

      if (!hasCritical || !hasMotor) {
        parsed = await createDocumentJsonCompletion({
          prompt: CERTIFICADO_ORIGEN_MULTI_PROMPT,
          buffer,
          mimeType,
          maxTokens: options?.rapido ? 3500 : 4500,
          maxTextChars: 32000,
          maxPdfPages: PDF_VISION_MAX_PAGES,
          preferHighDetail: true,
          forceRasterVision: true,
        });
      }
    }
  }

  const shared: PuertoLibreRegistroScanFields = {};
  const pais = parseString(parsed.pais_origen ?? parsed.country_of_origin);
  if (pais) shared.paisOrigen = pais;
  const marca = normalizeMarcaFabricante(parseString(parsed.marca));
  if (marca && isPlausibleMarcaFabricante(marca)) shared.marca = marca;
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
    const multi = asRecordArray(parsed.vehiculos).length > 1;
    const fields = facturaToFormFields(
      mapFactura({
        ...parsed,
        ...v,
        // En multi-unidad no heredar VIN/motor de cabecera (clonaba 1 motor a las 8 filas)
        serial_carroceria:
          resolveVinCandidate(v) ??
          v.serial_carroceria ??
          v.vin ??
          v.chasis ??
          v.code ??
          (multi ? null : parsed.serial_carroceria),
        serial_motor:
          pickSerialMotorRaw(v) ??
          (multi ? null : pickSerialMotorRaw(parsed)),
        pais_origen: v.pais_origen ?? parsed.pais_origen,
      })
    );
    if (certNo) {
      fields.numeroCertificadoOrigen = certNo;
    }
    const vCertNo = parseString(
      v.numero_certificado_origen ?? v.certificate_no ?? v.coo_no
    );
    if (vCertNo) {
      fields.numeroCertificadoOrigen = vCertNo;
    }
    if (!fields.paisOrigen && pais) fields.paisOrigen = pais;
    if (!fields.marca && marca) fields.marca = marca;
    else if (fields.marca && !isPlausibleMarcaFabricante(fields.marca)) {
      if (looksLikeCheryModelName(fields.marca) && !fields.modelo?.trim()) {
        fields.modelo = inferCheryModelo(fields.marca) || fields.modelo;
      }
      fields.marca = marca ?? "";
    }
    if (!fields.anio && anio != null) fields.anio = String(anio);
    if (!fields.anio) {
      const y = resolveAnioFromSources(
        { ...parsed, ...v },
        fields.serialCarroceria || fields.vin
      );
      if (y != null) fields.anio = String(y);
    }
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

  vehiculos = applyCertEnginePairs(
    dedupeVehiculosBySerial(vehiculos),
    enginesFromText
  );
  if (vehiculos.length === 0 && enginesFromText.length > 0) {
    vehiculos = applyCertEnginePairs([], enginesFromText);
  }
  if (vehiculos.length === 0 && harvest.motors.length > 0) {
    vehiculos = harvest.motors.map((serialMotor) =>
      sanitizeVehiculoRowLocal({
        serialMotor,
        condicion: "nuevo",
        kilometraje: "0",
      })
    );
  }
  if (vehiculos.length === 0 && !options?.rapido) {
    const local = await extractFacturaLocalFromDocument(buffer, mimeType);
    if (local.vehiculos.length > 0) {
      return {
        shared: { ...local.shared, ...shared },
        vehiculos: applyCertEnginePairs(
          local.vehiculos.map((v) => ({
            ...v,
            numeroCertificadoOrigen:
              shared.numeroCertificadoOrigen ?? v.numeroCertificadoOrigen,
          })),
          enginesFromText
        ),
        enginePairs: harvest.pairs,
        engineNos: harvest.motors,
      };
    }
    if (llmError) throw llmError;
  }
  return {
    shared,
    vehiculos,
    enginePairs: harvest.pairs,
    engineNos: harvest.motors,
  };
}

/**
 * Elige la fila OCR del certificado que corresponde al VIN del expediente.
 * Si no hay match en un multi-VIN, no inventa el nº de otra unidad (solo cabecera).
 */
export function pickCertificadoScanForVin(
  extracted: DocMultiExtracted,
  targetVin: string | null | undefined
): PuertoLibreRegistroScanFields {
  const repairedTarget = certVinKey(targetVin);

  let matched: PuertoLibreRegistroScanFields | undefined;
  if (repairedTarget && extracted.vehiculos.length > 0) {
    const keys = extracted.vehiculos.map((v) =>
      certVinKey(v.serialCarroceria || v.vin)
    );
    const hit = matchSerialKeyAmong(repairedTarget, keys);
    const idx = hit ? keys.findIndex((k) => k === hit) : -1;
    if (idx >= 0) matched = extracted.vehiculos[idx];
  }

  const fallback = extracted.vehiculos[0] ?? {};
  const picked = matched ?? fallback;
  const merged = mergeScanFields(extracted.shared, picked);

  if (matched?.numeroCertificadoOrigen?.trim()) {
    merged.numeroCertificadoOrigen = matched.numeroCertificadoOrigen.trim();
  } else if (
    repairedTarget &&
    extracted.vehiculos.length > 1 &&
    !matched
  ) {
    // Multi-unidad sin match de VIN: no tomar el nº de la primera fila.
    if (extracted.shared.numeroCertificadoOrigen?.trim()) {
      merged.numeroCertificadoOrigen =
        extracted.shared.numeroCertificadoOrigen.trim();
    } else {
      delete merged.numeroCertificadoOrigen;
    }
  } else if (picked.numeroCertificadoOrigen?.trim()) {
    merged.numeroCertificadoOrigen = picked.numeroCertificadoOrigen.trim();
  }

  return merged;
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
    if (k === "marca") {
      const patchMarca = normalizeMarcaFabricante(String(v));
      if (!patchMarca || !isPlausibleMarcaFabricante(patchMarca)) continue;
      const baseStr = current != null ? String(current).trim() : "";
      const baseValid =
        Boolean(baseStr) && isPlausibleMarcaFabricante(baseStr);
      if (baseValid) continue;
      out.marca = patchMarca;
      continue;
    }
    if (k === "vin" || k === "serialCarroceria") {
      const preferred = preferCompleteVin(
        current != null ? String(current) : "",
        String(v)
      );
      if (preferred) {
        (out as Record<string, unknown>)[k] = preferred;
      }
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
