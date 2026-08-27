/**
 * Límites y tipos permitidos para importaciones SmartImport (Fase 1).
 */

/** 50 MB en bytes. */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Máximo de registros por lote de importación. */
export const MAX_BATCH_SIZE = 10_000;

export const ALLOWED_MIME_TYPES = {
  json: {
    mime: ["application/json", "text/json"],
    extensions: [".json"],
  },
  csv: {
    mime: ["text/csv", "application/csv", "application/vnd.ms-excel"],
    extensions: [".csv"],
  },
  excel: {
    mime: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ],
    extensions: [".xlsx", ".xls"],
  },
  xml: {
    mime: ["application/xml", "text/xml"],
    extensions: [".xml"],
  },
} as const;

export const ENCODING = "utf-8" as const;

export const FILE_CONFIG = {
  MAX_FILE_SIZE,
  MAX_BATCH_SIZE,
  ALLOWED_MIME_TYPES,
  ENCODING,
} as const;

/** Lista plana de MIME types aceptados. */
export function getAllowedMimeList(): string[] {
  return Object.values(ALLOWED_MIME_TYPES).flatMap((entry) => [...entry.mime]);
}

/** Lista plana de extensiones aceptadas (con punto, minúsculas). */
export function getAllowedExtensionList(): string[] {
  return Object.values(ALLOWED_MIME_TYPES).flatMap((entry) => [
    ...entry.extensions,
  ]);
}
