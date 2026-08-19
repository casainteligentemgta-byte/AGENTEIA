import type { CargaMasivaRow } from "@/lib/importacion/carga-masiva-template";
import { normalizeRif } from "@/lib/validations/rif";
import {
  inferCheryModelo,
  isModeloFragmentInColor,
  looksLikeCheryModelName,
  looksLikeCheryVin,
  repairCheryMarcaModelo,
} from "@/lib/importacion/chery-modelo";
import { preferCompleteVin, repairCheryWmi } from "@/lib/importacion/vin-text";
import {
  computeCompletitudDatos,
  isPlaceholderDato,
  type CompletitudNivel,
} from "@/lib/importacion/completitud-datos";

export function normalizeSerialKey(serial: string): string {
  return repairCheryWmi(
    serial.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
  );
}

const SERIAL_PREFIX_MIN = 11;

/**
 * Empareja VIN exacto o un prefijo único (≥11). Si el OCR recortó el chasis
 * de la factura, el certificado con 17 caracteres puede completar la fila.
 */
export function matchSerialKeyAmong(
  needle: string,
  haystack: string[]
): string | null {
  const n = normalizeSerialKey(needle);
  if (!n) return null;
  const keys = [
    ...new Set(haystack.map((h) => normalizeSerialKey(h)).filter(Boolean)),
  ];
  if (keys.includes(n)) return n;
  if (n.length < SERIAL_PREFIX_MIN) return null;
  const hits = keys.filter(
    (k) =>
      k.length >= SERIAL_PREFIX_MIN && (k.startsWith(n) || n.startsWith(k))
  );
  return hits.length === 1 ? hits[0]! : null;
}

export function lookupBySerialPrefix<T>(
  map: Map<string, T>,
  serial: string
): T | undefined {
  const n = normalizeSerialKey(serial);
  if (!n) return undefined;
  const matched = matchSerialKeyAmong(n, [...map.keys()]);
  return matched ? map.get(matched) : undefined;
}

const ROW_MERGE_SKIP = new Set(["id", "error", "fuente"]);

function fillEmptyRowFields(
  base: CargaMasivaRow,
  incoming: CargaMasivaRow
): CargaMasivaRow {
  const next: CargaMasivaRow = { ...base };
  (Object.keys(incoming) as (keyof CargaMasivaRow)[]).forEach((key) => {
    if (ROW_MERGE_SKIP.has(key)) return;
    const incomingVal = incoming[key];
    const currentVal = next[key];
    if (typeof incomingVal !== "string" || !incomingVal.trim()) return;
    if (key === "vin" || key === "serialCarroceria") {
      const preferred = preferCompleteVin(
        typeof currentVal === "string" ? currentVal : "",
        incomingVal
      );
      if (preferred) (next[key] as string) = preferred;
      return;
    }
    if (typeof currentVal === "string" && currentVal.trim()) return;
    (next[key] as string) = incomingVal;
  });
  if (!next.fuente && incoming.fuente) next.fuente = incoming.fuente;
  return next;
}

/** Une filas por VIN/serial: completa huecos y añade vehículos nuevos. */
export function mergeCargaMasivaRowsByVin(
  existing: CargaMasivaRow[],
  incoming: CargaMasivaRow[]
): CargaMasivaRow[] {
  const result = [...existing];
  const indexBySerial = new Map<string, number>();
  result.forEach((row, index) => {
    const key = normalizeSerialKey(row.serialCarroceria || row.vin);
    if (key) indexBySerial.set(key, index);
  });
  for (const row of incoming) {
    const key = normalizeSerialKey(row.serialCarroceria || row.vin);
    const matched = key
      ? matchSerialKeyAmong(key, [...indexBySerial.keys()])
      : null;
    if (matched && indexBySerial.has(matched)) {
      const index = indexBySerial.get(matched)!;
      result[index] = fillEmptyRowFields(result[index]!, row);
      const mergedKey = normalizeSerialKey(
        result[index]!.serialCarroceria || result[index]!.vin
      );
      if (mergedKey && mergedKey !== matched) {
        indexBySerial.delete(matched);
        indexBySerial.set(mergedKey, index);
      }
      continue;
    }
    if (key) indexBySerial.set(key, result.length);
    result.push(row);
  }
  return result;
}

/** Corrige filas Chery ya en UI: marca, modelo desde «PRO MAX», limpia VIN. */
export function healCargaMasivaCheryRows(rows: CargaMasivaRow[]): CargaMasivaRow[] {
  const anyChery = rows.some((r) => {
    const vin = normalizeSerialKey(r.serialCarroceria || r.vin);
    return (
      looksLikeCheryVin(vin) ||
      /^cherr?y$/i.test(r.marca.trim()) ||
      looksLikeCheryModelName(r.marca) ||
      looksLikeCheryModelName(r.modelo)
    );
  });
  if (!anyChery) return rows;

  const bestModelo =
    rows
      .map((r) => {
        const fixed = repairCheryMarcaModelo(r.marca, r.modelo);
        return inferCheryModelo(
          fixed.modelo,
          isModeloFragmentInColor(r.color) ? r.color : null
        );
      })
      .filter(Boolean)
      .sort((a, b) => (b?.length ?? 0) - (a?.length ?? 0))[0] ?? null;

  return rows.map((r) => {
    const vin = normalizeSerialKey(r.serialCarroceria || r.vin);
    const colorWasModelo = isModeloFragmentInColor(r.color);
    const { marca: fixedMarca, modelo: fixedModeloBase } = repairCheryMarcaModelo(
      r.marca,
      r.modelo
    );
    const modelo =
      inferCheryModelo(fixedModeloBase, colorWasModelo ? r.color : null) ||
      bestModelo ||
      fixedModeloBase;
    return {
      ...r,
      marca: fixedMarca || "Chery",
      modelo: modelo || fixedModeloBase,
      color: colorWasModelo ? "" : r.color,
      vin: vin || r.vin,
      serialCarroceria: vin || r.serialCarroceria,
    };
  });
}

/** VIN ISO: 17 caracteres visibles sin recortar el input. */
export const VIN_VISIBLE_CHARS = 17;
/** Año del modelo: 4 dígitos. */
export const ANIO_VISIBLE_CHARS = 4;
/** Serial motor: ancho extra para ver el valor completo en móvil. */
export const SERIAL_MOTOR_VISIBLE_CHARS = 24;

export type VehicleFieldCol = {
  key: keyof CargaMasivaRow;
  label: string;
  wide?: boolean;
  /** Identificador (VIN/serial): ancho fijo para ver el valor completo. */
  code?: boolean;
};

/** Columnas editables por vehículo (no se repiten aduana/BL/importador). */
export const VEHICLE_FIELD_COLS: VehicleFieldCol[] = [
  { key: "marca", label: "Marca" },
  { key: "modelo", label: "Modelo" },
  { key: "color", label: "Color" },
  { key: "anio", label: "Año" },
  { key: "serialMotor", label: "Serial motor", wide: true, code: true },
  { key: "vin", label: "VIN", wide: true, code: true },
  { key: "serialCarroceria", label: "Serial carrocería", wide: true, code: true },
  { key: "kilometraje", label: "Km" },
  { key: "condicion", label: "Condición" },
  { key: "observaciones", label: "Obs. (unidad/llave)", wide: true },
];

const FIELD_INPUT_BASE =
  "rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-slate-100 outline-none focus:border-cyan-500/50";

export function vehicleFieldHeaderClass(col: VehicleFieldCol): string {
  if (col.key === "anio") return "min-w-[4ch]";
  if (col.key === "serialMotor") return "min-w-[24ch]";
  if (col.code) return "min-w-[17ch]";
  return "";
}

export function vehicleFieldInputSize(col: VehicleFieldCol): number | undefined {
  if (col.key === "anio") return ANIO_VISIBLE_CHARS;
  if (col.key === "serialMotor") return SERIAL_MOTOR_VISIBLE_CHARS;
  if (col.code) return VIN_VISIBLE_CHARS;
  return undefined;
}

export function vehicleFieldInputClass(col: VehicleFieldCol): string {
  if (col.key === "anio") {
    return `${FIELD_INPUT_BASE} box-content w-[4ch] min-w-[4ch] max-w-[4ch] text-center font-mono text-[13px] tabular-nums`;
  }
  if (col.key === "serialMotor") {
    return `${FIELD_INPUT_BASE} box-content w-[24ch] min-w-[24ch] max-w-none font-mono text-[13px] tracking-tight`;
  }
  if (col.code) {
    return `${FIELD_INPUT_BASE} box-content w-[17ch] min-w-[17ch] max-w-none font-mono text-[13px] tracking-tight`;
  }
  return `w-full min-w-[7rem] ${FIELD_INPUT_BASE}${col.wide ? " min-w-[10rem]" : ""}`;
}

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

export function motorPendiente(serialMotor: string): boolean {
  return isPlaceholderDato(serialMotor);
}

/** Semáforo de completitud por vehículo (carga masiva). */
export type SemaforoNivel = CompletitudNivel;

export type VehicleSemaforo = {
  nivel: SemaforoNivel;
  /** Datos fuertes faltantes (marca/modelo/VIN). */
  criticos: string[];
  /** Huecos medios; el expediente se crea y se completa después. */
  avisos: string[];
  /** true si hay VIN de 17 → se puede crear el expediente. */
  registrable: boolean;
  label: string;
  detail: string;
};

/**
 * Semáforo = completitud (no es un candado de registro):
 * - rojo: faltan datos fuertes (marca/modelo) o VIN inválido
 * - ámbar: faltan motor/color/año → se crea y se completa después
 * - verde: sin pendientes
 * Registrable = VIN 17 chars (rojo/ámbar/verde con VIN válido se registran).
 */
export function vehicleSemaforo(row: CargaMasivaRow): VehicleSemaforo {
  const c = computeCompletitudDatos({
    marca: row.marca,
    modelo: row.modelo,
    color: row.color,
    anio: row.anio,
    serialMotor: row.serialMotor,
    vin: row.vin,
    serialCarroceria: row.serialCarroceria,
    numeroCertificadoOrigen: row.numeroCertificadoOrigen,
  });

  const criticos = [...c.criticos];
  const avisos = [...c.medios];

  if (row.error?.trim() && !c.registrable) {
    criticos.push("error de validación");
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

  if (/^(PRO(\s*MAX)?|MAX)$/i.test(row.color.trim())) {
    if (!avisos.includes("color")) avisos.push("color");
  }

  let nivel: SemaforoNivel = c.nivel;
  if (criticos.length > 0 || !c.registrable) nivel = "rojo";
  else if (avisos.length > 0) nivel = "ambar";
  else nivel = "verde";

  if (nivel === "rojo") {
    return {
      nivel,
      criticos,
      avisos,
      registrable: c.registrable,
      label: c.registrable
        ? "Rojo · se crea; completar después"
        : "Rojo · sin VIN (no se registra)",
      detail:
        criticos.length > 0
          ? `Falta: ${criticos.join(", ")}`
          : c.detail,
    };
  }
  if (nivel === "ambar") {
    return {
      nivel,
      criticos,
      avisos,
      registrable: true,
      label: "Ámbar · completar después",
      detail: `Completar: ${avisos.join(", ")}`,
    };
  }
  return {
    nivel: "verde",
    criticos,
    avisos,
    registrable: true,
    label: "Verde · datos completos",
    detail: "Sin pendientes",
  };
}

export function resumenSemaforo(rows: CargaMasivaRow[]): {
  verde: number;
  ambar: number;
  rojo: number;
  /** Filas con VIN válido → se crean expedientes. */
  aptos: CargaMasivaRow[];
  /** Sin VIN válido → no se pueden crear. */
  bloqueados: CargaMasivaRow[];
} {
  let verde = 0;
  let ambar = 0;
  let rojo = 0;
  const aptos: CargaMasivaRow[] = [];
  const bloqueados: CargaMasivaRow[] = [];
  for (const row of rows) {
    const s = vehicleSemaforo(row);
    if (s.nivel === "verde") verde += 1;
    else if (s.nivel === "ambar") ambar += 1;
    else rojo += 1;

    if (s.registrable) aptos.push(row);
    else bloqueados.push(row);
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
