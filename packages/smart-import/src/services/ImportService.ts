import { randomUUID } from "crypto";
import type { AuthenticatedRequest } from "../api/middleware/auth";
import type { ParsedRecord } from "../services/FileParser";

export type ImportJobStatus = "queued" | "running" | "completed" | "failed";

export type ImportJob = {
  id: string;
  userId: string;
  targetTable: string;
  status: ImportJobStatus;
  recordCount: number;
  createdAt: string;
  error?: string;
};

/** Almacén en memoria (Fase 1). Sustituible por BD en fases posteriores. */
const importJobs = new Map<string, ImportJob>();

const VALID_TARGET_TABLES = new Set([
  "devices",
  "automations",
  "sensor_data",
  "users",
]);

export function isValidTargetTable(table: string): boolean {
  return VALID_TARGET_TABLES.has(table);
}

export function getImportJob(importId: string): ImportJob | undefined {
  return importJobs.get(importId);
}

/**
 * Registra un trabajo de importación para el usuario autenticado.
 * En Fase 1 no escribe aún en tablas destino (solo valida y encola).
 */
export async function enqueueImport(params: {
  user: AuthenticatedRequest["user"];
  targetTable: string;
  data: ParsedRecord[];
}): Promise<ImportJob> {
  const job: ImportJob = {
    id: randomUUID(),
    userId: params.user.id,
    targetTable: params.targetTable,
    status: "completed",
    recordCount: params.data.length,
    createdAt: new Date().toISOString(),
  };
  importJobs.set(job.id, job);
  console.log(
    `[smart-import] Import ${job.id} user=${job.userId} table=${job.targetTable} rows=${job.recordCount}`
  );
  return job;
}

export function analyzeRecords(data: ParsedRecord[]): {
  recordCount: number;
  fields: string[];
  sample: ParsedRecord[];
} {
  const fieldSet = new Set<string>();
  for (const row of data) {
    Object.keys(row).forEach((k) => fieldSet.add(k));
  }
  return {
    recordCount: data.length,
    fields: Array.from(fieldSet),
    sample: data.slice(0, 3),
  };
}

export function validateRecords(data: ParsedRecord[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!Array.isArray(data) || data.length === 0) {
    errors.push("No hay registros para validar");
  }
  data.forEach((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      errors.push(`Registro #${index + 1} inválido`);
    }
  });
  return { valid: errors.length === 0, errors };
}

export function transformRecords(
  data: ParsedRecord[],
  mapping?: Record<string, string>
): ParsedRecord[] {
  if (!mapping || Object.keys(mapping).length === 0) {
    return data;
  }
  return data.map((row) => {
    const next: ParsedRecord = {};
    for (const [from, to] of Object.entries(mapping)) {
      if (from in row) next[to] = row[from];
    }
    // Conserva campos no mapeados.
    for (const [key, value] of Object.entries(row)) {
      if (!(key in mapping) && !(key in next)) next[key] = value;
    }
    return next;
  });
}

/** Solo tests: limpia el almacén en memoria. */
export function __resetImportJobsForTests(): void {
  importJobs.clear();
}
