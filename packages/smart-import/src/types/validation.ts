/**
 * Tipos de validación SmartImport (Fase 2).
 */

export type ValidationError = {
  field?: string;
  message: string;
  rowIndex?: number;
  code?: string;
  value?: unknown;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  validCount: number;
  invalidCount: number;
  /** Hits de caché en esta operación (si aplica). */
  cacheHit?: boolean;
};

export type ForeignKey = {
  field: string;
  table: string;
  column: string;
};
