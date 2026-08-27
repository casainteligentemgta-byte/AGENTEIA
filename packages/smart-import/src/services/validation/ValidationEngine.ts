import type { z } from "zod";
import type { ValidationError, ValidationResult } from "../../types/validation";

/**
 * Motor de validación por lotes con esquemas Zod.
 */
export class ValidationEngine {
  /**
   * Valida un arreglo de registros contra un esquema Zod.
   */
  async validateBatch(
    records: unknown[],
    schema: z.ZodSchema
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    let validCount = 0;

    for (let i = 0; i < records.length; i++) {
      const parsed = schema.safeParse(records[i]);
      if (parsed.success) {
        validCount += 1;
        continue;
      }
      for (const issue of parsed.error.issues) {
        errors.push({
          rowIndex: i,
          field: issue.path.join(".") || undefined,
          message: issue.message,
          code: issue.code,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      validCount,
      invalidCount: records.length - validCount,
    };
  }
}
