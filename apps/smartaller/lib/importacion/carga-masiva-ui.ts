import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { normalizeRif } from "@/lib/validations/rif";
import {
  inferCheryModelo,
  isModeloFragmentInColor,
} from "@/lib/importacion/factura-row-fidelity";
import { repairCheryWmi } from "@/lib/importacion/vin-text";

export function normalizeSerialKey(serial: string): string {
  return repairCheryWmi(
    serial.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  );
}

/** Corrige filas Chery ya en UI: marca, modelo desde «PRO MAX», limpia VIN. */
export function healCargaMasivaCheryRows(rows: CargaMasivaRow[]): CargaMasivaRow[] {
  const anyChery = rows.some((r) => {
    const vin = normalizeSerialKey(r.serialCarroceria || r.vin);
    return /^LVV|^LVT|^LVD/.test(vin) || /^chery$/i.test(r.marca.trim());
  });
  if (!anyChery) return rows;

  const bestModelo =
    rows
      .map((r) =>
        inferCheryModelo(
          r.modelo,
          isModeloFragmentInColor(r.color) ? r.color : null
        )
      )
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0] ?? null;

  return rows.map((r) => {
    const vin = normalizeSerialKey(r.serialCarroceria || r.vin);
    const colorWasModelo = isModeloFragmentInColor(r.color);
    const modelo =
      inferCheryModelo(r.modelo, colorWasModelo ? r.color : null) ||
      bestModelo ||
      r.modelo;
    return {
      ...r,
      marca: r.marca.trim() || "Chery",
      modelo: modelo || r.modelo,
      color: colorWasModelo ? "" : r.color,
      vin: vin || r.vin,
      serialCarroceria: vin || r.serialCarroceria,
    };
  });
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

/** Semáforo de completitud por vehículo (carga masiva). */
export type SemaforoNivel = "rojo" | "ambar" | "verde";

export type VehicleSemaforo = {
  nivel: SemaforoNivel;
  /** Bloquean el registro (seguridad / integridad). */
  criticos: string[];
  /** Anuncian huecos; el expediente puede crearse y completarse después. */
  avisos: string[];
  label: string;
  detail: string;
};

/**
 * Semáforo rígido:
 * - rojo: falta VIN/marca/modelo o hay error Zod → no se registra
 * - ámbar: faltan motor real, color, año o nº cert. → se anuncia; registro opcional
 * - verde: listo para alta automática
 */
export function vehicleSemaforo(row: CargaMasivaRow): VehicleSemaforo {
  const criticos: string[] = [];
  const avisos: string[] = [];

  if (row.error?.trim()) criticos.push("error de validación");
  if (!row.marca.trim()) criticos.push("marca");
  if (!row.modelo.trim()) criticos.push("modelo");
  const vinRaw = (row.serialCarroceria.trim() || row.vin.trim()).replace(
    /[^A-Za-z0-9]/g,
    ""
  );
  if (!vinRaw) criticos.push("VIN");
  else if (vinRaw.length !== 17) criticos.push("VIN incompleto");
  else if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(vinRaw)) criticos.push("VIN");
  // Color con fragmentos de modelo (PRO MAX) → avisar
  if (/^(PRO(\s*MAX)?|MAX)$/i.test(row.color.trim())) {
    avisos.push("color (parece modelo)");
  }

  const condicion = row.condicion.trim().toLowerCase();
  if (condicion && condicion !== "nuevo" && condicion !== "usado") {
    criticos.push("condición");
  }
  if (
    (condicion === "usado" || condicion === "used") &&
    !/^(si|sí|no|true|false|1|0)$/i.test(row.esSubasta.trim())
  ) {
    avisos.push("subasta");
  }

  if (motorPendiente(row.serialMotor)) avisos.push("motor");
  if (!row.color.trim()) avisos.push("color");
  if (!row.anio.trim()) avisos.push("año");
  if (!row.numeroCertificadoOrigen.trim()) avisos.push("nº cert.");

  if (criticos.length > 0) {
    return {
      nivel: "rojo",
      criticos,
      avisos,
      label: "Rojo · no registrar",
      detail: `Falta: ${criticos.join(", ")}`,
    };
  }
  if (avisos.length > 0) {
    return {
      nivel: "ambar",
      criticos,
      avisos,
      label: "Ámbar · datos faltantes",
      detail: `Completar: ${avisos.join(", ")}`,
    };
  }
  return {
    nivel: "verde",
    criticos,
    avisos,
    label: "Verde · listo",
    detail: "Datos mínimos completos",
  };
}

export function resumenSemaforo(rows: CargaMasivaRow[]): {
  verde: number;
  ambar: number;
  rojo: number;
  aptos: CargaMasivaRow[];
  bloqueados: CargaMasivaRow[];
} {
  let verde = 0;
  let ambar = 0;
  let rojo = 0;
  const aptos: CargaMasivaRow[] = [];
  const bloqueados: CargaMasivaRow[] = [];
  for (const row of rows) {
    const s = vehicleSemaforo(row);
    if (s.nivel === "verde") {
      verde += 1;
      aptos.push(row);
    } else if (s.nivel === "ambar") {
      ambar += 1;
      aptos.push(row);
    } else {
      rojo += 1;
      bloqueados.push(row);
    }
  }
  return { verde, ambar, rojo, aptos, bloqueados };
}

/** @deprecated Preferir vehicleSemaforo. Compatible con etapas/progreso. */
export function vehicleCompleteness(row: CargaMasivaRow): {
  complete: boolean;
  missing: string[];
} {
  const s = vehicleSemaforo(row);
  return {
    complete: s.nivel === "verde",
    missing: [...s.criticos, ...s.avisos],
  };
}
