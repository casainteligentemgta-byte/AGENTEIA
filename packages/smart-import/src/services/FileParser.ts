import { XMLParser } from "fast-xml-parser";
import * as XLSX from "xlsx";
import {
  FILE_CONFIG,
  getAllowedExtensionList,
  getAllowedMimeList,
} from "../config/fileConfig";

export type ParsedRecord = Record<string, unknown>;

export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type ParseFileInput = {
  name: string;
  size: number;
  type?: string | null;
  buffer: Buffer;
};

/**
 * Parser de archivos de importación (JSON, CSV, XLSX, XML)
 * con validación de tamaño, MIME y tamaño de lote.
 */
export class FileParser {
  private validateFile(file: {
    name: string;
    size: number;
    type?: string | null;
  }): FileValidationResult {
    if (!file.name || !file.name.trim()) {
      return { valid: false, error: "El archivo no tiene nombre" };
    }

    if (file.size <= 0) {
      return { valid: false, error: "El archivo está vacío" };
    }

    if (file.size > FILE_CONFIG.MAX_FILE_SIZE) {
      const mb = Math.round(FILE_CONFIG.MAX_FILE_SIZE / (1024 * 1024));
      return {
        valid: false,
        error: `El archivo supera el tamaño máximo permitido (${mb} MB)`,
      };
    }

    const mime = (file.type ?? "").toLowerCase().trim();
    const ext = this.getExtension(file.name);
    const allowedMimes = getAllowedMimeList().map((m) => m.toLowerCase());
    const allowedExts = getAllowedExtensionList();

    const mimeOk = mime.length > 0 && allowedMimes.includes(mime);
    const extOk = allowedExts.includes(ext);

    // Algunos navegadores mandan MIME genérico; en ese caso validamos por extensión.
    const genericMime =
      !mime ||
      mime === "application/octet-stream" ||
      mime === "binary/octet-stream";

    if (!mimeOk && !(genericMime && extOk)) {
      if (!extOk) {
        return {
          valid: false,
          error:
            "Tipo de archivo no permitido. Usa JSON, CSV, Excel (.xlsx/.xls) o XML",
        };
      }
      return {
        valid: false,
        error: `MIME type no permitido: ${mime || "(vacío)"}`,
      };
    }

    return { valid: true };
  }

  private getExtension(fileName: string): string {
    const idx = fileName.lastIndexOf(".");
    if (idx < 0) return "";
    return fileName.slice(idx).toLowerCase();
  }

  private assertBatchSize(rows: unknown[], label: string): ParsedRecord[] {
    if (!Array.isArray(rows)) {
      throw new Error(`${label}: se esperaba un arreglo de registros`);
    }
    if (rows.length === 0) {
      throw new Error(`${label}: el archivo no contiene registros`);
    }
    if (rows.length > FILE_CONFIG.MAX_BATCH_SIZE) {
      throw new Error(
        `${label}: el lote supera el máximo de ${FILE_CONFIG.MAX_BATCH_SIZE} registros`
      );
    }
    return rows.map((row, index) => {
      if (row == null || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(
          `${label}: el registro #${index + 1} no es un objeto válido`
        );
      }
      return row as ParsedRecord;
    });
  }

  /**
   * Valida y parsea el archivo según su extensión / MIME.
   */
  async parseFile(file: ParseFileInput): Promise<ParsedRecord[]> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const ext = this.getExtension(file.name);
    const mime = (file.type ?? "").toLowerCase();

    if (ext === ".json" || mime.includes("json")) {
      return this.parseJSON(file.buffer);
    }
    if (ext === ".csv" || mime.includes("csv")) {
      return this.parseCSV(file.buffer);
    }
    if (
      ext === ".xlsx" ||
      ext === ".xls" ||
      mime.includes("spreadsheet") ||
      mime === "application/vnd.ms-excel"
    ) {
      // .xls genérico también puede ser CSV mal etiquetado; priorizamos extensión.
      if (ext === ".csv") return this.parseCSV(file.buffer);
      return this.parseXLSX(file.buffer);
    }
    if (ext === ".xml" || mime.includes("xml")) {
      return this.parseXML(file.buffer);
    }

    throw new Error(
      "No se pudo determinar el formato del archivo. Usa .json, .csv, .xlsx o .xml"
    );
  }

  parseJSON(buffer: Buffer): ParsedRecord[] {
    let parsed: unknown;
    try {
      const text = buffer.toString(FILE_CONFIG.ENCODING).trim();
      if (!text) {
        throw new Error("JSON vacío");
      }
      parsed = JSON.parse(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "JSON inválido";
      throw new Error(`JSON inválido: ${message}`);
    }

    // Permite { data: [...] } o array directo.
    const rows = Array.isArray(parsed)
      ? parsed
      : parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as { data?: unknown }).data)
        ? ((parsed as { data: unknown[] }).data as unknown[])
        : null;

    if (!rows) {
      throw new Error("JSON: se esperaba un arreglo o un objeto con clave data");
    }

    return this.assertBatchSize(rows, "JSON");
  }

  parseCSV(buffer: Buffer): ParsedRecord[] {
    const text = buffer.toString(FILE_CONFIG.ENCODING).replace(/^\uFEFF/, "");
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new Error("CSV: se requiere cabecera y al menos una fila de datos");
    }

    const headers = this.splitCsvLine(lines[0]!).map((h) => h.trim());
    if (headers.length === 0 || headers.some((h) => !h)) {
      throw new Error("CSV: cabecera inválida");
    }

    const rows: ParsedRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.splitCsvLine(lines[i]!);
      const row: ParsedRecord = {};
      headers.forEach((header, idx) => {
        row[header] = cols[idx] ?? "";
      });
      rows.push(row);
    }

    return this.assertBatchSize(rows, "CSV");
  }

  parseXLSX(buffer: Buffer): ParsedRecord[] {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "archivo ilegible";
      throw new Error(`Excel inválido: ${message}`);
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error("Excel: el libro no tiene hojas");
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error("Excel: no se pudo leer la primera hoja");
    }

    const rows = XLSX.utils.sheet_to_json<ParsedRecord>(sheet, {
      defval: "",
      raw: false,
    });

    return this.assertBatchSize(rows, "Excel");
  }

  parseXML(buffer: Buffer): ParsedRecord[] {
    const text = buffer.toString(FILE_CONFIG.ENCODING).trim();
    if (!text) {
      throw new Error("XML vacío");
    }

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
      isArray: (_name, jpath) =>
        jpath === "root.item" ||
        jpath === "root.record" ||
        jpath === "items.item" ||
        jpath === "records.record" ||
        jpath.endsWith(".row"),
    });

    let parsed: unknown;
    try {
      parsed = parser.parse(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : "XML inválido";
      throw new Error(`XML inválido: ${message}`);
    }

    const rows = this.extractXmlRows(parsed);
    return this.assertBatchSize(rows, "XML");
  }

  private extractXmlRows(parsed: unknown): unknown[] {
    if (!parsed || typeof parsed !== "object") {
      throw new Error("XML: estructura no reconocida");
    }
    const root = parsed as Record<string, unknown>;

    const candidates = [
      root.item,
      root.record,
      root.row,
      (root.items as Record<string, unknown> | undefined)?.item,
      (root.records as Record<string, unknown> | undefined)?.record,
      (root.root as Record<string, unknown> | undefined)?.item,
      (root.root as Record<string, unknown> | undefined)?.record,
      (root.data as Record<string, unknown> | undefined)?.item,
      (root.data as Record<string, unknown> | undefined)?.row,
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
      if (candidate && typeof candidate === "object") return [candidate];
    }

    // Último recurso: primer arreglo de objetos encontrado en el root.
    for (const value of Object.values(root)) {
      if (
        Array.isArray(value) &&
        value.every((v) => v && typeof v === "object")
      ) {
        return value;
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const nested of Object.values(value as Record<string, unknown>)) {
          if (
            Array.isArray(nested) &&
            nested.every((v) => v && typeof v === "object")
          ) {
            return nested;
          }
        }
      }
    }

    throw new Error(
      "XML: no se encontraron registros (usa <item>, <record> o <row>)"
    );
  }

  /** CSV simple con comillas dobles. */
  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        result.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    result.push(current);
    return result;
  }
}

export const fileParser = new FileParser();
