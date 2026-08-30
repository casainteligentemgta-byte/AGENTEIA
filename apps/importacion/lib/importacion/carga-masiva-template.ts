import { puertoLibreAltaSchema, type PuertoLibreAltaInput } from "@/lib/schemas/importacion-alta";
import {
  inferCheryModelo,
  isModeloFragmentInColor,
  looksLikeCheryModelName,
  repairCheryMarcaModelo,
} from "@/lib/importacion/chery-modelo";
import type { PuertoLibreRegistroScanFields } from "@/lib/importacion/scan-fields";
import { repairCheryWmi } from "@/lib/importacion/vin-text";

/** Columnas de la plantilla (orden fijo para Excel). */
export const CARGA_MASIVA_COLUMNS = [
  { key: "marca", header: "marca", required: true, hint: "Ej. Toyota" },
  { key: "modelo", header: "modelo", required: true, hint: "Ej. Corolla" },
  { key: "color", header: "color", required: true, hint: "Ej. Blanco" },
  { key: "anio", header: "anio", required: true, hint: "2024" },
  { key: "serial_motor", header: "serial_motor", required: true, hint: "Serial motor" },
  {
    key: "vin",
    header: "vin",
    required: true,
    hint: "VIN internacional",
  },
  {
    key: "serial_carroceria",
    header: "serial_carroceria",
    required: true,
    hint: "Serial carrocería SENIAT",
  },
  { key: "kilometraje", header: "kilometraje", required: true, hint: "0" },
  {
    key: "condicion",
    header: "condicion",
    required: true,
    hint: "nuevo o usado",
  },
  {
    key: "es_subasta",
    header: "es_subasta",
    required: false,
    hint: "si|no (obligatorio si usado)",
  },
  {
    key: "partida_arancelaria",
    header: "partida_arancelaria",
    required: false,
    hint: "Ej. 8703.23.91",
  },
  {
    key: "cilindrada_cc",
    header: "cilindrada_cc",
    required: false,
    hint: "cc",
  },
  {
    key: "tipo_combustible",
    header: "tipo_combustible",
    required: false,
    hint: "gasolina|diesel|electrico|hibrido|gnv|otro",
  },
  {
    key: "fecha_llegada_buque",
    header: "fecha_llegada_buque",
    required: true,
    hint: "YYYY-MM-DD",
  },
  {
    key: "importador_nombre",
    header: "importador_nombre",
    required: true,
    hint: "Razón social",
  },
  {
    key: "importador_documento",
    header: "importador_documento",
    required: false,
    hint: "J-12345678-9",
  },
  {
    key: "importador_telefono",
    header: "importador_telefono",
    required: false,
    hint: "",
  },
  {
    key: "importador_email",
    header: "importador_email",
    required: false,
    hint: "",
  },
  {
    key: "importador_direccion",
    header: "importador_direccion",
    required: false,
    hint: "Dirección fiscal",
  },
  {
    key: "puerto",
    header: "puerto",
    required: false,
    hint: "Puerto de descarga",
  },
  {
    key: "modalidad_transito",
    header: "modalidad_transito",
    required: false,
    hint: "ninguno | transito | uso24",
  },
  {
    key: "aduana_transito",
    header: "aduana_transito",
    required: false,
    hint: "Si tránsito / USO24",
  },
  { key: "aduana", header: "aduana", required: false, hint: "Ej. Guanta" },
  { key: "numero_bl", header: "numero_bl", required: false, hint: "Nº BL" },
  { key: "pais_origen", header: "pais_origen", required: false, hint: "China" },
  { key: "valor_cif", header: "valor_cif", required: false, hint: "USD" },
  {
    key: "tasa_cambio_bcv",
    header: "tasa_cambio_bcv",
    required: false,
    hint: "Bs/USD",
  },
  {
    key: "costos_arancelarios_usd",
    header: "costos_arancelarios_usd",
    required: false,
    hint: "USD",
  },
  {
    key: "gastos_puerto_usd",
    header: "gastos_puerto_usd",
    required: false,
    hint: "USD",
  },
  {
    key: "flete_internacional_usd",
    header: "flete_internacional_usd",
    required: false,
    hint: "USD",
  },
  {
    key: "costo_total_landed_usd",
    header: "costo_total_landed_usd",
    required: false,
    hint: "CIF+aranceles+flete+gastos",
  },
  {
    key: "numero_expediente_seniat",
    header: "numero_expediente_seniat",
    required: false,
    hint: "Expediente SENIAT",
  },
  { key: "numero_dav", header: "numero_dav", required: false, hint: "Nº DAV" },
  {
    key: "numero_certificado_origen",
    header: "numero_certificado_origen",
    required: false,
    hint: "",
  },
  {
    key: "numero_lista_empaque",
    header: "numero_lista_empaque",
    required: false,
    hint: "",
  },
  {
    key: "numero_poliza_transporte",
    header: "numero_poliza_transporte",
    required: false,
    hint: "",
  },
  {
    key: "observaciones",
    header: "observaciones",
    required: false,
    hint: "",
  },
] as const;

export type CargaMasivaColumnKey = (typeof CARGA_MASIVA_COLUMNS)[number]["key"];

/** Fila editable en la UI de previsualización. */
export type CargaMasivaRow = {
  id: string;
  marca: string;
  modelo: string;
  color: string;
  anio: string;
  serialMotor: string;
  vin: string;
  serialCarroceria: string;
  kilometraje: string;
  condicion: string;
  esSubasta: string;
  partidaArancelaria: string;
  cilindradaCc: string;
  tipoCombustible: string;
  fechaLlegadaBuque: string;
  importadorNombre: string;
  importadorDocumento: string;
  importadorTelefono: string;
  importadorEmail: string;
  importadorDireccion: string;
  /** Puerto de descarga / llegada (distinto de aduana SENIAT). */
  puerto: string;
  modalidadTransito: string;
  aduanaTransito: string;
  aduana: string;
  numeroBl: string;
  paisOrigen: string;
  valorCif: string;
  tasaCambioBcv: string;
  costosArancelariosUsd: string;
  gastosPuertoUsd: string;
  fleteInternacionalUsd: string;
  costoTotalLandedUsd: string;
  numeroExpedienteSeniat: string;
  numeroDav: string;
  numeroCertificadoOrigen: string;
  numeroListaEmpaque: string;
  numeroPolizaTransporte: string;
  observaciones: string;
  /** Origen: archivo o OCR. */
  fuente?: string;
  error?: string | null;
};

const HEADER_ALIASES: Record<string, CargaMasivaColumnKey> = {
  marca: "marca",
  brand: "marca",
  modelo: "modelo",
  model: "modelo",
  color: "color",
  colour: "color",
  description: "color",
  "description of goods": "color",
  descriptionofgoods: "color",
  anio: "anio",
  año: "anio",
  year: "anio",
  serial_motor: "serial_motor",
  serialmotor: "serial_motor",
  "serial motor": "serial_motor",
  "serial de motor": "serial_motor",
  "n motor": "serial_motor",
  "no motor": "serial_motor",
  "no. motor": "serial_motor",
  "n de motor": "serial_motor",
  "numero motor": "serial_motor",
  "num motor": "serial_motor",
  engine: "serial_motor",
  "engine serial": "serial_motor",
  engineserial: "serial_motor",
  "engine serial no": "serial_motor",
  "engine serial number": "serial_motor",
  engineserialno: "serial_motor",
  engineserialnumber: "serial_motor",
  "engine no": "serial_motor",
  "engine nro": "serial_motor",
  engineno: "serial_motor",
  enginenro: "serial_motor",
  "engine number": "serial_motor",
  enginenumber: "serial_motor",
  "motor serial": "serial_motor",
  motorserial: "serial_motor",
  "motor no": "serial_motor",
  "motor number": "serial_motor",
  motorno: "serial_motor",
  motornumber: "serial_motor",
  vin: "vin",
  code: "vin",
  serial_carroceria: "serial_carroceria",
  serialcarroceria: "serial_carroceria",
  "serial carroceria": "serial_carroceria",
  chasis: "serial_carroceria",
  kilometraje: "kilometraje",
  km: "kilometraje",
  odometro: "kilometraje",
  condicion: "condicion",
  condición: "condicion",
  condition: "condicion",
  es_subasta: "es_subasta",
  essubasta: "es_subasta",
  subasta: "es_subasta",
  auction: "es_subasta",
  partida_arancelaria: "partida_arancelaria",
  partida: "partida_arancelaria",
  arancel: "partida_arancelaria",
  cilindrada_cc: "cilindrada_cc",
  cilindrada: "cilindrada_cc",
  cc: "cilindrada_cc",
  tipo_combustible: "tipo_combustible",
  combustible: "tipo_combustible",
  fuel: "tipo_combustible",
  fecha_llegada_buque: "fecha_llegada_buque",
  fechallegadabuque: "fecha_llegada_buque",
  "fecha llegada buque": "fecha_llegada_buque",
  eta: "fecha_llegada_buque",
  importador_nombre: "importador_nombre",
  importadornombre: "importador_nombre",
  "importador nombre": "importador_nombre",
  importador: "importador_nombre",
  consignee: "importador_nombre",
  importador_documento: "importador_documento",
  rif: "importador_documento",
  importador_telefono: "importador_telefono",
  telefono: "importador_telefono",
  importador_email: "importador_email",
  email: "importador_email",
  importador_direccion: "importador_direccion",
  direccion_fiscal: "importador_direccion",
  direccion: "importador_direccion",
  puerto: "puerto",
  puerto_descarga: "puerto",
  "puerto descarga": "puerto",
  modalidad_transito: "modalidad_transito",
  modalidadtransito: "modalidad_transito",
  "modalidad transito": "modalidad_transito",
  aduana_transito: "aduana_transito",
  aduanatransito: "aduana_transito",
  "aduana transito": "aduana_transito",
  aduana: "aduana",
  numero_bl: "numero_bl",
  numerobl: "numero_bl",
  bl: "numero_bl",
  "nº bl": "numero_bl",
  pais_origen: "pais_origen",
  paisorigen: "pais_origen",
  "pais origen": "pais_origen",
  origen: "pais_origen",
  valor_cif: "valor_cif",
  valorcif: "valor_cif",
  cif: "valor_cif",
  tasa_cambio_bcv: "tasa_cambio_bcv",
  tasa_bcv: "tasa_cambio_bcv",
  bcv: "tasa_cambio_bcv",
  costos_arancelarios_usd: "costos_arancelarios_usd",
  aranceles: "costos_arancelarios_usd",
  gastos_puerto_usd: "gastos_puerto_usd",
  gastos_puerto: "gastos_puerto_usd",
  flete_internacional_usd: "flete_internacional_usd",
  flete: "flete_internacional_usd",
  costo_total_landed_usd: "costo_total_landed_usd",
  landed: "costo_total_landed_usd",
  numero_expediente_seniat: "numero_expediente_seniat",
  expediente_seniat: "numero_expediente_seniat",
  numero_dav: "numero_dav",
  dav: "numero_dav",
  numero_certificado_origen: "numero_certificado_origen",
  certificado_origen: "numero_certificado_origen",
  numero_lista_empaque: "numero_lista_empaque",
  lista_empaque: "numero_lista_empaque",
  numero_poliza_transporte: "numero_poliza_transporte",
  poliza_transporte: "numero_poliza_transporte",
  observaciones: "observaciones",
  notas: "observaciones",
};

export const CARGA_MASIVA_MAX_ROWS = 80;

export function emptyCargaMasivaRow(
  partial?: Partial<CargaMasivaRow>
): CargaMasivaRow {
  return {
    id: partial?.id ?? cryptoRandomId(),
    marca: "",
    modelo: "",
    color: "",
    anio: "",
    serialMotor: "",
    vin: "",
    serialCarroceria: "",
    kilometraje: "0",
    condicion: "nuevo",
    esSubasta: "",
    partidaArancelaria: "",
    cilindradaCc: "",
    tipoCombustible: "",
    fechaLlegadaBuque: "",
    importadorNombre: "",
    importadorDocumento: "",
    importadorTelefono: "",
    importadorEmail: "",
    importadorDireccion: "",
    puerto: "",
    modalidadTransito: "",
    aduanaTransito: "",
    aduana: "",
    numeroBl: "",
    paisOrigen: "",
    valorCif: "",
    tasaCambioBcv: "",
    costosArancelariosUsd: "",
    gastosPuertoUsd: "",
    fleteInternacionalUsd: "",
    costoTotalLandedUsd: "",
    numeroExpedienteSeniat: "",
    numeroDav: "",
    numeroCertificadoOrigen: "",
    numeroListaEmpaque: "",
    numeroPolizaTransporte: "",
    observaciones: "",
    fuente: partial?.fuente,
    error: null,
    ...partial,
  };
}

/** Convierte campos OCR / formulario a una fila de la planilla masiva. */
export function cargaMasivaRowFromScanFields(
  fields: PuertoLibreRegistroScanFields,
  fuente: string
): CargaMasivaRow {
  const serial = fields.serialCarroceria ?? fields.vin ?? "";
  const vin = fields.vin ?? serial;
  return emptyCargaMasivaRow({
    marca: fields.marca ?? "",
    modelo: fields.modelo ?? "",
    color: fields.color ?? "",
    anio: fields.anio ?? "",
    serialMotor: fields.serialMotor ?? "",
    vin,
    serialCarroceria: serial || vin,
    kilometraje: fields.kilometraje ?? "0",
    condicion: fields.condicion ?? "nuevo",
    esSubasta:
      fields.esSubasta === "true" ? "si" : fields.esSubasta === "false" ? "no" : "",
    partidaArancelaria: fields.partidaArancelaria ?? "",
    cilindradaCc: fields.cilindradaCc ?? "",
    tipoCombustible: fields.tipoCombustible ?? "",
    fechaLlegadaBuque: fields.fechaLlegadaBuque ?? "",
    importadorNombre: fields.importadorNombre ?? "",
    importadorDocumento: fields.importadorDocumento ?? "",
    importadorTelefono: fields.importadorTelefono ?? "",
    importadorEmail: fields.importadorEmail ?? "",
    importadorDireccion: fields.importadorDireccion ?? "",
    puerto: fields.puerto ?? "",
    modalidadTransito: fields.modalidadTransito ?? "",
    aduanaTransito: fields.aduanaTransito ?? "",
    aduana: fields.aduana ?? "",
    numeroBl: fields.numeroBl ?? "",
    paisOrigen: fields.paisOrigen ?? "",
    valorCif: fields.valorCif ?? "",
    tasaCambioBcv: fields.tasaCambioBcv ?? "",
    costosArancelariosUsd: fields.costosArancelariosUsd ?? "",
    gastosPuertoUsd: fields.gastosPuertoUsd ?? "",
    fleteInternacionalUsd: fields.fleteInternacionalUsd ?? "",
    costoTotalLandedUsd: fields.costoTotalLandedUsd ?? "",
    numeroExpedienteSeniat: fields.numeroExpedienteSeniat ?? "",
    numeroDav: fields.numeroDav ?? "",
    numeroCertificadoOrigen: fields.numeroCertificadoOrigen ?? "",
    numeroListaEmpaque: fields.numeroListaEmpaque ?? "",
    numeroPolizaTransporte: fields.numeroPolizaTransporte ?? "",
    observaciones: fields.observaciones ?? "",
    fuente,
  });
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeHeader(raw: string): CargaMasivaColumnKey | null {
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['"`´]/g, "")
    .replace(/[#№]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!key) return null;
  if (HEADER_ALIASES[key]) return HEADER_ALIASES[key];
  const collapsed = key.replace(/\s+/g, "");
  return HEADER_ALIASES[collapsed] ?? null;
}

function csvEscape(value: string): string {
  if (/[",\n\r;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** CSV UTF-8 con BOM para Excel (separador coma). */
export function buildCargaMasivaCsvTemplate(): string {
  const headers = CARGA_MASIVA_COLUMNS.map((c) => c.header);
  const example = [
    "Toyota",
    "Corolla",
    "Blanco",
    "2024",
    "ENG123456",
    "JTDBR32E720123456",
    "JTDBR32E720123456",
    "0",
    "nuevo",
    "",
    "8703.23.91",
    "1800",
    "gasolina",
    "2026-09-15",
    "Importadora Ejemplo CA",
    "J-12345678-9",
    "04141234567",
    "contacto@ejemplo.com",
    "Av. Principal, Caracas",
    "Guanta",
    "BL-ABC-001",
    "Japon",
    "18500",
    "36.50",
    "",
    "",
    "",
    "",
    "",
    "Ejemplo de fila — borrar o editar",
  ];
  const blank = CARGA_MASIVA_COLUMNS.map(() => "");
  const lines = [
    headers.join(","),
    example.map(csvEscape).join(","),
    blank.join(","),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function rowFromSpreadsheetRecord(
  record: Record<string, string>,
  fuente?: string
): CargaMasivaRow {
  const get = (key: CargaMasivaColumnKey) => (record[key] ?? "").trim();
  const serialCarroceria = get("serial_carroceria");
  const vin = get("vin") || serialCarroceria;
  return emptyCargaMasivaRow({
    marca: get("marca"),
    modelo: get("modelo"),
    color: get("color"),
    anio: get("anio"),
    serialMotor: get("serial_motor"),
    vin,
    serialCarroceria: serialCarroceria || vin,
    kilometraje: get("kilometraje") || "0",
    condicion: get("condicion").toLowerCase() || "nuevo",
    esSubasta: normalizeSiNo(get("es_subasta")),
    partidaArancelaria: get("partida_arancelaria"),
    cilindradaCc: get("cilindrada_cc"),
    tipoCombustible: get("tipo_combustible").toLowerCase(),
    fechaLlegadaBuque: normalizeFecha(get("fecha_llegada_buque")),
    importadorNombre: get("importador_nombre"),
    importadorDocumento: get("importador_documento"),
    importadorTelefono: get("importador_telefono"),
    importadorEmail: get("importador_email"),
    importadorDireccion: get("importador_direccion"),
    puerto: get("puerto"),
    modalidadTransito: get("modalidad_transito").toLowerCase(),
    aduanaTransito: get("aduana_transito"),
    aduana: get("aduana"),
    numeroBl: get("numero_bl"),
    paisOrigen: get("pais_origen"),
    valorCif: get("valor_cif"),
    tasaCambioBcv: get("tasa_cambio_bcv"),
    costosArancelariosUsd: get("costos_arancelarios_usd"),
    gastosPuertoUsd: get("gastos_puerto_usd"),
    fleteInternacionalUsd: get("flete_internacional_usd"),
    costoTotalLandedUsd: get("costo_total_landed_usd"),
    numeroExpedienteSeniat: get("numero_expediente_seniat"),
    numeroDav: get("numero_dav"),
    numeroCertificadoOrigen: get("numero_certificado_origen"),
    numeroListaEmpaque: get("numero_lista_empaque"),
    numeroPolizaTransporte: get("numero_poliza_transporte"),
    observaciones: get("observaciones"),
    fuente,
  });
}

function normalizeSiNo(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (!v) return "";
  if (["si", "sí", "yes", "true", "1", "s"].includes(v)) return "si";
  if (["no", "false", "0", "n"].includes(v)) return "no";
  return v;
}

function normalizeFecha(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Excel serial date as number string
  const serial = Number(v);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const epoch = Date.UTC(1899, 11, 30) + serial * 86400000;
    const d = new Date(epoch);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return v;
}

export function cargaMasivaRowToAltaInput(
  row: CargaMasivaRow
):
  | { ok: true; data: PuertoLibreAltaInput }
  | { ok: false; error: string } {
  const condicionRaw = row.condicion.trim().toLowerCase();
  const condicion =
    condicionRaw === "nuevo" || condicionRaw === "new"
      ? "nuevo"
      : condicionRaw === "usado" || condicionRaw === "used"
        ? "usado"
        : condicionRaw;

  const esSubastaRaw = normalizeSiNo(row.esSubasta);
  const esSubasta =
    condicion === "usado"
      ? esSubastaRaw === "si"
        ? true
        : esSubastaRaw === "no"
          ? false
          : null
      : false;

  const vin = row.vin.trim() || row.serialCarroceria.trim();
  const serialCarroceria = row.serialCarroceria.trim() || vin;

  const parsed = puertoLibreAltaSchema.safeParse({
    marca: row.marca,
    modelo: row.modelo,
    color: row.color,
    anio: row.anio ? Number(row.anio) : undefined,
    serialMotor: row.serialMotor,
    vin,
    serialCarroceria,
    kilometraje: row.kilometraje !== "" ? Number(row.kilometraje) : undefined,
    condicion,
    esSubasta,
    partidaArancelaria: row.partidaArancelaria,
    partidaArancelariaFuente: row.partidaArancelaria.trim()
      ? /ocr|factura|documento/i.test(row.fuente ?? "")
        ? "ocr"
        : "manual"
      : undefined,
    partidaArancelariaFundamento:
      row.partidaArancelaria.trim() && /ocr|factura|documento/i.test(row.fuente ?? "")
        ? "Leída del documento (OCR)."
        : undefined,
    cilindradaCc: row.cilindradaCc,
    tipoCombustible: row.tipoCombustible || null,
    fechaLlegadaBuque: row.fechaLlegadaBuque,
    regimen: "puerto_libre",
    importadorNombre: row.importadorNombre,
    importadorDocumento: row.importadorDocumento,
    importadorTelefono: row.importadorTelefono,
    importadorEmail: row.importadorEmail,
    importadorDireccion: row.importadorDireccion,
    puerto: row.puerto,
    modalidadTransito:
      row.modalidadTransito === "ninguno" ||
      row.modalidadTransito === "transito" ||
      row.modalidadTransito === "uso24"
        ? row.modalidadTransito
        : undefined,
    aduanaTransito: row.aduanaTransito,
    aduana: row.aduana,
    numeroBl: row.numeroBl,
    paisOrigen: row.paisOrigen,
    valorCif: row.valorCif,
    tasaCambioBcv: row.tasaCambioBcv,
    costosArancelariosUsd: row.costosArancelariosUsd,
    gastosPuertoUsd: row.gastosPuertoUsd,
    fleteInternacionalUsd: row.fleteInternacionalUsd,
    costoTotalLandedUsd: row.costoTotalLandedUsd,
    numeroExpedienteSeniat: row.numeroExpedienteSeniat,
    numeroDav: row.numeroDav,
    numeroCertificadoOrigen: row.numeroCertificadoOrigen,
    numeroListaEmpaque: row.numeroListaEmpaque,
    numeroPolizaTransporte: row.numeroPolizaTransporte,
    observaciones: row.observaciones,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.errors[0]?.message ?? "Fila inválida",
    };
  }
  return { ok: true, data: parsed.data };
}

function healCheryCargaMasivaRows(rows: CargaMasivaRow[]): CargaMasivaRow[] {
  const anyChery = rows.some((r) => {
    const vin = repairCheryWmi(
      (r.serialCarroceria || r.vin).replace(/[^A-Za-z0-9]/gi, "").toUpperCase()
    );
    return (
      /^LVV|^LVT|^LVD/.test(vin) ||
      /^cherr?y$/i.test(r.marca.trim()) ||
      looksLikeCheryModelName(r.marca) ||
      looksLikeCheryModelName(r.modelo)
    );
  });
  if (!anyChery) return rows;

  const bestModelo =
    rows
      .map((r) => {
        const fixed = repairCheryMarcaModelo(r.marca, r.modelo);
        return inferCheryModelo(
          fixed.modelo,
          isModeloFragmentInColor(r.color) ? r.color : null
        );
      })
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0] ?? null;

  return rows.map((r) => {
    const vin = repairCheryWmi(
      (r.serialCarroceria || r.vin).replace(/[^A-Za-z0-9]/gi, "").toUpperCase()
    );
    const colorWasModelo = isModeloFragmentInColor(r.color);
    const { marca: fixedMarca, modelo: fixedModeloBase } = repairCheryMarcaModelo(
      r.marca,
      r.modelo
    );
    const modelo =
      inferCheryModelo(fixedModeloBase, colorWasModelo ? r.color : null) ||
      bestModelo ||
      fixedModeloBase;
    return {
      ...r,
      marca: fixedMarca || "Chery",
      modelo: modelo || fixedModeloBase,
      color: colorWasModelo ? "" : r.color,
      vin: vin || r.vin,
      serialCarroceria: vin || r.serialCarroceria,
    };
  });
}

/** Errores que impiden crear expediente (solo sin VIN válido). */
function criticalCargaMasivaError(row: CargaMasivaRow): string | null {
  const vin = repairCheryWmi(
    (row.serialCarroceria || row.vin).replace(/[^A-Za-z0-9]/gi, "").toUpperCase()
  );
  if (!vin) return "Ingresa el VIN";
  if (vin.length !== 17) return "VIN incompleto (debe tener 17 caracteres)";
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return "VIN inválido";
  const condicion = row.condicion.trim().toLowerCase();
  if (condicion && condicion !== "nuevo" && condicion !== "usado") {
    return "Condición debe ser nuevo o usado";
  }
  return null;
}

export function validateCargaMasivaRows(rows: CargaMasivaRow[]): CargaMasivaRow[] {
  const seenSerials = new Set<string>();
  return healCheryCargaMasivaRows(rows).map((row) => {
    const critical = criticalCargaMasivaError(row);
    if (critical) {
      return { ...row, error: critical };
    }
    const serial = repairCheryWmi(
      (row.serialCarroceria || row.vin).replace(/[^A-Za-z0-9]/gi, "").toUpperCase()
    );
    if (seenSerials.has(serial)) {
      return { ...row, error: "Serial de carrocería duplicado en el archivo" };
    }
    seenSerials.add(serial);
    return { ...row, error: null };
  });
}
