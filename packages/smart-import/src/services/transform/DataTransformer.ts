/**
 * Transformador base de registros (mapeo / normalización).
 */
export class DataTransformer {
  constructor(protected mapping: Record<string, string> = {}) {}

  setMapping(mapping: Record<string, string>): void {
    this.mapping = mapping;
  }

  getMapping(): Record<string, string> {
    return this.mapping;
  }

  /**
   * Transforma un registro aplicando el mapeo de campos.
   */
  transformRecord(record: Record<string, unknown>): Record<string, unknown> {
    if (!this.mapping || Object.keys(this.mapping).length === 0) {
      return { ...record };
    }

    const next: Record<string, unknown> = {};
    for (const [from, to] of Object.entries(this.mapping)) {
      if (from in record) next[to] = record[from];
    }
    for (const [key, value] of Object.entries(record)) {
      if (!(key in this.mapping) && !(key in next)) next[key] = value;
    }
    return next;
  }

  /**
   * Transforma un arreglo completo de registros.
   */
  transform(records: Record<string, unknown>[]): Record<string, unknown>[] {
    return records.map((row) => this.transformRecord(row));
  }
}
