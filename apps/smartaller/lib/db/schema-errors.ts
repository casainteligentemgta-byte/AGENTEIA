/** Errores de PostgREST/Supabase por columnas o tablas aún no migradas. */
export function isMissingSchemaError(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("schema cache") ||
    lower.includes("could not find") ||
    (lower.includes("column") && lower.includes("not found"))
  );
}
