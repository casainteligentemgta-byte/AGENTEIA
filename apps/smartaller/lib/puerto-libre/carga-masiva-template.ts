import { puertoLibreAltaSchema, type PuertoLibreAltaInput } from "@/lib/schemas/puerto-libre-alta";

/** Columnas de la plantilla (orden fijo para Excel). */
export const CARGA_MASIVA_COLUMNS = [
  { key: "marca", header: "marca", required: true, hint: "Ej. Toyota" },
  { key: "modelo", header: "modelo", required: true, hint: "Ej. Corolla" },
  { key: "color", header: "color", required: true, hint: "Ej. Blanco" },
  { key: "anio", header: "anio", required: true, hint: "2024" },
  { key: "serial_motor", header: "serial_motor", required: true, hint: "Serial motor" },
  {
    key: "serial_carroceria",
    header: "serial_carroceria",
    required: true,
    hint: "VIN / chasis",
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
    hint: "RIF",
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
  { key: "aduana", header: "aduana", required: false, hint: "Ej. Guanta" },
  { key: "numero_bl", header: "numero_bl", required: false, hint: "Nº BL" },
  { key: "pais_origen", header: "pais_origen", required: false, hint: "China" },
  { key: "valor_cif", header: "valor_cif", required: false, hint: "USD" },
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
  serialCarroceria: string;
  kilometraje: string;
  condicion: string;
  esSubasta: string;
  fechaLlegadaBuque: string;
  importadorNombre: string;
  importadorDocumento: string;
  importadorTelefono: string;
  importadorEmail: string;
  aduana: string;
  numeroBl: string;
  paisOrigen: string;
  valorCif: string;
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
  anio: "anio",
  año: "anio",
  year: "anio",
  serial_motor: "serial_motor",
  serialmotor: "serial_motor",
  "serial motor": "serial_motor",
  engine: "serial_motor",
  serial_carroceria: "serial_carroceria",
  serialcarroceria: "serial_carroceria",
  "serial carroceria": "serial_carroceria",
  vin: "serial_carroceria",
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
  aduana: "aduana",
  puerto: "aduana",
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
    serialCarroceria: "",
    kilometraje: "0",
    condicion: "nuevo",
    esSubasta: "",
    fechaLlegadaBuque: "",
    importadorNombre: "",
    importadorDocumento: "",
    importadorTelefono: "",
    importadorEmail: "",
    aduana: "",
    numeroBl: "",
    paisOrigen: "",
    valorCif: "",
    observaciones: "",
    fuente: partial?.fuente,
    error: null,
    ...partial,
  };
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
    .replace(/['"]/g, "");
  return HEADER_ALIASES[key] ?? null;
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
    "0",
    "nuevo",
    "",
    "2026-09-15",
    "Importadora Ejemplo CA",
    "J-12345678-9",
    "04141234567",
    "contacto@ejemplo.com",
    "Guanta",
    "BL-ABC-001",
    "Japon",
    "18500",
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
  return emptyCargaMasivaRow({
    marca: get("marca"),
    modelo: get("modelo"),
    color: get("color"),
    anio: get("anio"),
    serialMotor: get("serial_motor"),
    serialCarroceria: get("serial_carroceria"),
    kilometraje: get("kilometraje") || "0",
    condicion: get("condicion").toLowerCase() || "nuevo",
    esSubasta: normalizeSiNo(get("es_subasta")),
    fechaLlegadaBuque: normalizeFecha(get("fecha_llegada_buque")),
    importadorNombre: get("importador_nombre"),
    importadorDocumento: get("importador_documento"),
    importadorTelefono: get("importador_telefono"),
    importadorEmail: get("importador_email"),
    aduana: get("aduana"),
    numeroBl: get("numero_bl"),
    paisOrigen: get("pais_origen"),
    valorCif: get("valor_cif"),
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

  const parsed = puertoLibreAltaSchema.safeParse({
    marca: row.marca,
    modelo: row.modelo,
    color: row.color,
    anio: row.anio ? Number(row.anio) : undefined,
    serialMotor: row.serialMotor,
    serialCarroceria: row.serialCarroceria,
    kilometraje: row.kilometraje !== "" ? Number(row.kilometraje) : undefined,
    condicion,
    esSubasta,
    fechaLlegadaBuque: row.fechaLlegadaBuque,
    importadorNombre: row.importadorNombre,
    importadorDocumento: row.importadorDocumento,
    importadorTelefono: row.importadorTelefono,
    importadorEmail: row.importadorEmail,
    aduana: row.aduana,
    numeroBl: row.numeroBl,
    paisOrigen: row.paisOrigen,
    valorCif: row.valorCif,
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

export function validateCargaMasivaRows(rows: CargaMasivaRow[]): CargaMasivaRow[] {
  const seenSerials = new Set<string>();
  return rows.map((row) => {
    const result = cargaMasivaRowToAltaInput(row);
    if (!result.ok) {
      return { ...row, error: result.error };
    }
    const serial = result.data.serialCarroceria.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (seenSerials.has(serial)) {
      return { ...row, error: "Serial de carrocería duplicado en el archivo" };
    }
    seenSerials.add(serial);
    return { ...row, error: null };
  });
}
