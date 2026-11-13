export const PRESIDENCIA_PIN_MISSING_MSG =
  "El panel de presidencia está deshabilitado: falta configurar PRESIDENCIA_PIN.";

export function getPresidenciaPin(): string {
  return process.env.PRESIDENCIA_PIN?.trim() ?? "";
}

export function isPresidenciaProduction(): boolean {
  return (
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production"
  );
}

/** En producción el kiosk exige PIN configurado (fail-closed). En local, abierto si no hay PIN. */
export function presidenciaAllowsOpenAccess(): boolean {
  if (getPresidenciaPin()) return false;
  return !isPresidenciaProduction();
}

export function presidenciaPinConfigured(): boolean {
  return getPresidenciaPin().length > 0;
}
