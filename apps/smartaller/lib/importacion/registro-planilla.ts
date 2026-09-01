/**
 * Criterio del chip verde «Registro» en la planilla:
 * datos del vehículo + importador + factura + certificado.
 */
import {
  isModeloPendiente,
  isPlaceholderDato,
} from "@/lib/importacion/completitud-datos";

export type RegistroPlanillaCampos = {
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  anio?: string | number | null;
  serialMotor?: string | null;
  vin?: string | null;
  serialCarroceria?: string | null;
  kilometraje?: number | null;
  condicionVehiculo?: string | null;
  esSubasta?: boolean | null;
  importadorNombre?: string | null;
  tieneFactura: boolean;
  tieneCertificado: boolean;
};

export function esRegistroPlanillaCompleto(
  c: RegistroPlanillaCampos
): boolean {
  if (!c.tieneFactura || !c.tieneCertificado) return false;
  if (isPlaceholderDato(c.marca) || isModeloPendiente(c.modelo)) return false;
  if (isPlaceholderDato(c.color)) return false;

  const anioStr =
    c.anio == null || c.anio === "" ? "" : String(c.anio).trim();
  if (!anioStr || isPlaceholderDato(anioStr)) return false;
  if (isPlaceholderDato(c.serialMotor)) return false;
  if (isPlaceholderDato(c.vin) || isPlaceholderDato(c.serialCarroceria)) {
    return false;
  }
  if (c.kilometraje == null) return false;
  if (!c.condicionVehiculo?.trim()) return false;
  if (c.condicionVehiculo === "usado") {
    if (c.kilometraje <= 0) return false;
    if (typeof c.esSubasta !== "boolean") return false;
  }
  if (!c.importadorNombre?.trim()) return false;
  return true;
}
