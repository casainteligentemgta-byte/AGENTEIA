import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { normalizeRif } from "@/lib/validations/rif";

export function normalizeSerialKey(serial: string): string {
  return serial.trim().toUpperCase().replace(/\s+/g, "");
}

/** Columnas editables por vehículo (no se repiten aduana/BL/importador). */
export const VEHICLE_FIELD_COLS: {
  key: keyof CargaMasivaRow;
  label: string;
  wide?: boolean;
}[] = [
  { key: "marca", label: "Marca" },
  { key: "modelo", label: "Modelo" },
  { key: "color", label: "Color" },
  { key: "anio", label: "Año" },
  { key: "serialMotor", label: "Serial motor", wide: true },
  { key: "vin", label: "VIN", wide: true },
  { key: "serialCarroceria", label: "Serial carrocería", wide: true },
  { key: "kilometraje", label: "Km" },
  { key: "condicion", label: "Condición" },
  { key: "esSubasta", label: "Subasta" },
  { key: "valorCif", label: "CIF" },
  { key: "numeroCertificadoOrigen", label: "Nº cert. origen" },
  { key: "observaciones", label: "Obs. (unidad/llave)", wide: true },
];

export type SharedShipmentFields = {
  fechaLlegadaBuque: string;
  aduana: string;
  numeroBl: string;
  paisOrigen: string;
  tasaCambioBcv: string;
};

export const EMPTY_SHARED_SHIPMENT: SharedShipmentFields = {
  fechaLlegadaBuque: "",
  aduana: "",
  numeroBl: "",
  paisOrigen: "",
  tasaCambioBcv: "",
};

/** Importador detectado en documentos (solo para certificar vs. cliente elegido). */
export type DetectedImportador = {
  nombre: string;
  documento: string;
  direccion: string;
};

export const EMPTY_DETECTED_IMPORTADOR: DetectedImportador = {
  nombre: "",
  documento: "",
  direccion: "",
};

export type CertMatch = {
  serial: string;
  fileName: string;
};

export function sharedShipmentFromRows(rows: CargaMasivaRow[]): SharedShipmentFields {
  const first = rows[0];
  if (!first) return { ...EMPTY_SHARED_SHIPMENT };
  return {
    fechaLlegadaBuque: first.fechaLlegadaBuque ?? "",
    aduana: first.aduana ?? "",
    numeroBl: first.numeroBl ?? "",
    paisOrigen: first.paisOrigen ?? "",
    tasaCambioBcv: first.tasaCambioBcv ?? "",
  };
}

export function detectedImportadorFromRows(rows: CargaMasivaRow[]): DetectedImportador {
  const first = rows[0];
  if (!first) return { ...EMPTY_DETECTED_IMPORTADOR };
  return {
    nombre: first.importadorNombre ?? "",
    documento: first.importadorDocumento ?? "",
    direccion: first.importadorDireccion ?? "",
  };
}

/** True si no hay RIF en OCR o coincide con el del cliente seleccionado. */
export function rifCoincideConSeleccionado(
  detectedDocumento: string,
  selectedDocumento: string
): boolean {
  const a = normalizeRif(detectedDocumento);
  const b = normalizeRif(selectedDocumento);
  if (!a) return true;
  if (!b) return false;
  return a === b;
}

export function applySharedShipmentToRows(
  rows: CargaMasivaRow[],
  shared: SharedShipmentFields
): CargaMasivaRow[] {
  return rows.map((r) => ({
    ...r,
    fechaLlegadaBuque: shared.fechaLlegadaBuque.trim() || r.fechaLlegadaBuque,
    aduana: shared.aduana.trim() || r.aduana,
    numeroBl: shared.numeroBl.trim() || r.numeroBl,
    paisOrigen: shared.paisOrigen.trim() || r.paisOrigen,
    tasaCambioBcv: shared.tasaCambioBcv.trim() || r.tasaCambioBcv,
    error: null,
  }));
}

export function applyImportadorToRows(
  rows: CargaMasivaRow[],
  importador: {
    nombre: string;
    documento: string;
    telefono?: string | null;
    email?: string | null;
    direccion?: string | null;
  }
): CargaMasivaRow[] {
  return rows.map((r) => ({
    ...r,
    importadorNombre: importador.nombre,
    importadorDocumento: importador.documento,
    importadorTelefono: importador.telefono ?? r.importadorTelefono,
    importadorEmail: importador.email ?? r.importadorEmail,
    importadorDireccion: importador.direccion ?? r.importadorDireccion,
    error: null,
  }));
}

const PLACEHOLDER_MOTOR = /^(POR-COMPLETAR|N\/?A|S\/?D|-)?$/i;

export function motorPendiente(serialMotor: string): boolean {
  const v = serialMotor.trim();
  if (!v) return true;
  return PLACEHOLDER_MOTOR.test(v);
}

/** Campos que suelen completar el certificado de origen. */
export function vehicleCompleteness(row: CargaMasivaRow): {
  complete: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!row.marca.trim()) missing.push("marca");
  if (!row.modelo.trim()) missing.push("modelo");
  if (!row.color.trim()) missing.push("color");
  if (!row.anio.trim()) missing.push("año");
  if (motorPendiente(row.serialMotor)) missing.push("motor");
  if (!(row.serialCarroceria.trim() || row.vin.trim())) missing.push("VIN");
  if (!row.numeroCertificadoOrigen.trim()) missing.push("nº cert.");
  return { complete: missing.length === 0, missing };
}
