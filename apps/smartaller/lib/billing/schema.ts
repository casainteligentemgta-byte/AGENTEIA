/** La migración de pagos aún no está en este proyecto de Supabase. */
export function isBillingSchemaMissing(error: {
  message?: string;
  code?: string;
} | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "42703") return true;
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("does not exist") ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table")
  );
}
