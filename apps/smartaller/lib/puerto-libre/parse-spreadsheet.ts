import * as XLSX from "xlsx";
import {
  CARGA_MASIVA_MAX_ROWS,
  normalizeHeader,
  rowFromSpreadsheetRecord,
  type CargaMasivaColumnKey,
  type CargaMasivaRow,
} from "@/lib/puerto-libre/carga-masiva-template";

function detectDelimiter(headerLine: string): "," | ";" {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/** Parse CSV simple con comillas y delimitador , o ;. */
export function parseCsvToRecords(text: string): Record<string, string>[] {
  const cleaned = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = cleaned.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0] ?? "");
  const rows = lines.map((line) => splitCsvLine(line, delimiter));
  const headerCells = rows[0] ?? [];
  const keys = headerCells.map((h) => normalizeHeader(h));

  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i] ?? [];
    const record: Record<string, string> = {};
    let hasAny = false;
    keys.forEach((key, idx) => {
      if (!key) return;
      const value = (cells[idx] ?? "").trim();
      if (value) hasAny = true;
      record[key] = value;
    });
    if (hasAny) records.push(record);
  }
  return records;
}

function splitCsvLine(line: string, delimiter: "," | ";"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function sheetToRecords(sheet: XLSX.WorkSheet): Record<string, string>[] {
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  if (!matrix.length) return [];

  const headerRow = (matrix[0] ?? []).map((c) => String(c ?? ""));
  const keys = headerRow.map((h) => normalizeHeader(h));

  const records: Record<string, string>[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    const record: Record<string, string> = {};
    let hasAny = false;
    keys.forEach((key, idx) => {
      if (!key) return;
      const value = String(cells[idx] ?? "").trim();
      if (value) hasAny = true;
      record[key] = value;
    });
    if (hasAny) records.push(record);
  }
  return records;
}

export function parseSpreadsheetBuffer(
  buffer: Buffer,
  fileName: string
): { rows: CargaMasivaRow[]; error?: string } {
  const lower = fileName.toLowerCase();
  let records: Record<string, string>[] = [];

  try {
    if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      records = parseCsvToRecords(buffer.toString("utf8"));
    } else if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        return { rows: [], error: "El Excel no tiene hojas" };
      }
      const sheet = wb.Sheets[sheetName];
      records = sheetToRecords(sheet);
    } else {
      return {
        rows: [],
        error: "Formato no soportado. Usa .csv, .xlsx o .xls",
      };
    }
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "No se pudo leer el archivo",
    };
  }

  if (records.length === 0) {
    return { rows: [], error: "No se encontraron filas con datos" };
  }
  if (records.length > CARGA_MASIVA_MAX_ROWS) {
    return {
      rows: [],
      error: `Máximo ${CARGA_MASIVA_MAX_ROWS} vehículos por carga`,
    };
  }

  const knownKeys = new Set(
    Object.keys(records[0] ?? {}).filter(Boolean) as CargaMasivaColumnKey[]
  );
  if (!knownKeys.has("marca") || !knownKeys.has("serial_carroceria")) {
    return {
      rows: [],
      error:
        "Faltan columnas obligatorias (marca, serial_carroceria). Descarga la plantilla.",
    };
  }

  const rows = records.map((r, i) =>
    rowFromSpreadsheetRecord(r, `${fileName} · fila ${i + 2}`)
  );
  return { rows };
}

/** Genera .xlsx de plantilla con una fila de ejemplo. */
export function buildCargaMasivaXlsxBuffer(): Buffer {
  const headers = [
    "marca",
    "modelo",
    "color",
    "anio",
    "serial_motor",
    "serial_carroceria",
    "kilometraje",
    "condicion",
    "es_subasta",
    "fecha_llegada_buque",
    "importador_nombre",
    "importador_documento",
    "importador_telefono",
    "importador_email",
    "aduana",
    "numero_bl",
    "pais_origen",
    "valor_cif",
    "observaciones",
  ];
  const example = [
    "Toyota",
    "Corolla",
    "Blanco",
    2024,
    "ENG123456",
    "JTDBR32E720123456",
    0,
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
    18500,
    "Ejemplo — editar o borrar",
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, "Vehiculos");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(out);
}
