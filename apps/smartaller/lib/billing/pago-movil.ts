/** Datos de Pago Móvil (no van en una tabla pública). */
export const PAGO_MOVIL = {
  banco: "Banesco",
  telefono: "0414-7937270",
  cedula: "V-13.848.186",
} as const;

export type PagoMovilDatos = typeof PAGO_MOVIL;
