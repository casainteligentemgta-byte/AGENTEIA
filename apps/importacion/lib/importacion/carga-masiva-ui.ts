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
  porCompletarTextClass,
  type CompletitudNivel,
} from "@/lib/importacion/completitud-datos";
import {
  formatPuertosDescarga,
  parsePuertosDescarga,
} from "@/lib/importacion/puertos-venezuela";

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

/**
 * Empareja filas↔certificados 1:1 (evita que un solo motor/VIN de cert
 * se copie a las 8 unidades de una factura multi).
 * Prioriza exacto; luego prefijo único entre los que queden libres.
 */
export function pairSerialsOneToOne(
  rowSerials: string[],
  certSerials: string[]
): Map<string, string> {
  const rows = [
    ...new Set(rowSerials.map(normalizeSerialKey).filter(Boolean)),
  ];
  const certs = [
    ...new Set(certSerials.map(normalizeSerialKey).filter(Boolean)),
  ];
  /** rowSerial → certSerial */
  const paired = new Map<string, string>();
  const usedCert = new Set<string>();

  for (const row of rows) {
    if (certs.includes(row) && !usedCert.has(row)) {
      paired.set(row, row);
      usedCert.add(row);
    }
  }

  for (const row of rows) {
    if (paired.has(row) || row.length < SERIAL_PREFIX_MIN) continue;
    const candidates = certs.filter(
      (c) =>
        !usedCert.has(c) &&
        c.length >= SERIAL_PREFIX_MIN &&
        (c.startsWith(row) || row.startsWith(c))
    );
    if (candidates.length === 1) {
      paired.set(row, candidates[0]!);
      usedCert.add(candidates[0]!);
    }
  }

  return paired;
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
  { key: "tipoCombustible", label: "Combustible" },
  { key: "cilindradaCc", label: "Cilindrada" },
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

export function vehicleFieldInputClass(
  col: VehicleFieldCol,
  value?: string
): string {
  let base: string;
  if (col.key === "anio") {
    base = `${FIELD_INPUT_BASE} box-content w-[4ch] min-w-[4ch] max-w-[4ch] text-center font-mono text-[13px] tabular-nums`;
  } else if (col.key === "serialMotor") {
    base = `${FIELD_INPUT_BASE} box-content w-[24ch] min-w-[24ch] max-w-none font-mono text-[13px] tracking-tight`;
  } else if (col.code) {
    base = `${FIELD_INPUT_BASE} box-content w-[17ch] min-w-[17ch] max-w-none font-mono text-[13px] tracking-tight`;
  } else {
    base = `w-full min-w-[7rem] ${FIELD_INPUT_BASE}${col.wide ? " min-w-[10rem]" : ""}`;
  }
  const pending = porCompletarTextClass(value);
  return pending ? `${base} ${pending}` : base;
}

const STICKY_INDEX_SHADOW = "shadow-[2px_0_6px_rgba(0,0,0,0.45)]";

/** Cabecera de la columna # fija al desplazar la tabla en horizontal (Safari/iOS). */
export function cargaMasivaStickyIndexHeadClass(): string {
  return `sticky left-0 z-30 min-w-[4.25rem] bg-slate-900 px-2 py-2 text-center font-medium ${STICKY_INDEX_SHADOW}`;
}

/** Celda # con fondo opaco según semáforo (sticky requiere color sólido). */
export function cargaMasivaStickyIndexCellClass(
  nivel: SemaforoNivel,
  hasError: boolean
): string {
  const base = `sticky left-0 z-20 min-w-[4.25rem] px-2 py-1.5 align-top text-center text-sm font-semibold tabular-nums ${STICKY_INDEX_SHADOW}`;
  if (hasError || nivel === "rojo") return `${base} bg-red-950 text-slate-200`;
  if (nivel === "ambar") return `${base} bg-amber-950 text-slate-200`;
  return `${base} bg-slate-950 text-slate-400`;
}

export type SharedShipmentFields = {
  fechaLlegadaBuque: string;
  puerto: string;
  modalidadTransito: "" | "ninguno" | "transito" | "uso24";
  aduanaTransito: string;
  aduana: string;
  numeroBl: string;
  paisOrigen: string;
  tasaCambioBcv: string;
  /** Si true, pisa valores ya presentes en las filas. */
  sobrescribir: boolean;
};

export const EMPTY_SHARED_SHIPMENT: SharedShipmentFields = {
  fechaLlegadaBuque: "",
  puerto: "",
  modalidadTransito: "",
  aduanaTransito: "",
  aduana: "",
  numeroBl: "",
  paisOrigen: "",
  tasaCambioBcv: "",
  sobrescribir: false,
};

export const LOTE_MODALIDAD_TRANSITO_OPTIONS: {
  value: Exclude<SharedShipmentFields["modalidadTransito"], "">;
  label: string;
}[] = [
  { value: "ninguno", label: "Sin tránsito" },
  { value: "transito", label: "Tránsito" },
  { value: "uso24", label: "USO24" },
];

/** Combustible / cilindrada / condición para aplicar al lote entero. */
export type SharedLoteTechFields = {
  /** vacío = no tocar ese campo */
  condicion: "" | "nuevo" | "usado" | "subasta";
  tipoCombustible:
    | ""
    | "gasolina"
    | "diesel"
    | "electrico"
    | "hibrido"
    | "gnv"
    | "otro";
  cilindradaCc: string;
  /** Si true, pisa valores ya presentes en las filas. */
  sobrescribir: boolean;
};

export const EMPTY_SHARED_LOTE_TECH: SharedLoteTechFields = {
  condicion: "",
  tipoCombustible: "",
  cilindradaCc: "",
  sobrescribir: false,
};

export const LOTE_TIPO_COMBUSTIBLE_OPTIONS: {
  value: Exclude<SharedLoteTechFields["tipoCombustible"], "">;
  label: string;
}[] = [
  { value: "gasolina", label: "Gasolina" },
  { value: "diesel", label: "Diésel" },
  { value: "hibrido", label: "Híbrido" },
  { value: "electrico", label: "Eléctrico" },
  { value: "gnv", label: "GNV" },
  { value: "otro", label: "Otro" },
];

function isBlankTech(value: string | null | undefined): boolean {
  return !String(value ?? "").trim() || isPlaceholderDato(value);
}

export type ApplySharedRowOptions = {
  force?: boolean;
  /** Si se indica, solo toca esas filas. */
  ids?: readonly string[] | ReadonlySet<string>;
};

function rowIdsFilter(
  ids?: readonly string[] | ReadonlySet<string>
): Set<string> | null {
  if (!ids) return null;
  return ids instanceof Set ? ids : new Set(ids);
}

/**
 * Aplica condición / combustible / cilindrada a todas las filas del lote.
 * Campos vacíos en `tech` no se tocan.
 * `force: true` (botón Aplicar) pisa valores; si no, solo rellena huecos.
 */
export function applySharedLoteTechToRows(
  rows: CargaMasivaRow[],
  tech: SharedLoteTechFields,
  options?: ApplySharedRowOptions
): CargaMasivaRow[] {
  const cond = tech.condicion;
  const fuel = tech.tipoCombustible;
  const cc = tech.cilindradaCc.trim().replace(/[^\d]/g, "");
  const force = options?.force ?? tech.sobrescribir;
  const only = rowIdsFilter(options?.ids);

  if (!cond && !fuel && !cc) return rows;

  return rows.map((r) => {
    if (only && !only.has(r.id)) return r;
    const next: CargaMasivaRow = { ...r, error: null };

    if (cond && (force || isBlankTech(r.condicion))) {
      if (cond === "subasta") {
        next.condicion = "usado";
        next.esSubasta = "true";
      } else {
        next.condicion = cond;
        next.esSubasta = "false";
      }
    }

    if (fuel && (force || isBlankTech(r.tipoCombustible))) {
      next.tipoCombustible = fuel;
    }

    if (cc && (force || isBlankTech(r.cilindradaCc))) {
      next.cilindradaCc = cc;
    }

    return next;
  });
}

/** Prefill suave desde la primera fila del lote (si todas coinciden, mejor UX). */
export function sharedLoteTechFromRows(rows: CargaMasivaRow[]): SharedLoteTechFields {
  const first = rows[0];
  if (!first) return { ...EMPTY_SHARED_LOTE_TECH };

  const sameCond = rows.every((r) => {
    const a = (r.condicion ?? "").trim().toLowerCase();
    const b = (first.condicion ?? "").trim().toLowerCase();
    const sa = (r.esSubasta ?? "").toLowerCase() === "true";
    const sb = (first.esSubasta ?? "").toLowerCase() === "true";
    return a === b && sa === sb;
  });
  const sameFuel = rows.every(
    (r) =>
      (r.tipoCombustible ?? "").trim().toLowerCase() ===
      (first.tipoCombustible ?? "").trim().toLowerCase()
  );
  const sameCc = rows.every(
    (r) => (r.cilindradaCc ?? "").trim() === (first.cilindradaCc ?? "").trim()
  );

  let condicion: SharedLoteTechFields["condicion"] = "";
  if (sameCond) {
    if ((first.esSubasta ?? "").toLowerCase() === "true") condicion = "subasta";
    else if ((first.condicion ?? "").trim().toLowerCase() === "usado")
      condicion = "usado";
    else if ((first.condicion ?? "").trim().toLowerCase() === "nuevo")
      condicion = "nuevo";
  }

  const fuelRaw = (first.tipoCombustible ?? "").trim().toLowerCase();
  const tipoCombustible = (
    sameFuel &&
    LOTE_TIPO_COMBUSTIBLE_OPTIONS.some((o) => o.value === fuelRaw)
      ? fuelRaw
      : ""
  ) as SharedLoteTechFields["tipoCombustible"];

  return {
    condicion,
    tipoCombustible,
    cilindradaCc: sameCc ? (first.cilindradaCc ?? "").trim() : "",
    sobrescribir: false,
  };
}

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

  const modalidadRaw = (first.modalidadTransito ?? "").trim().toLowerCase();
  const modalidadTransito = (
    LOTE_MODALIDAD_TRANSITO_OPTIONS.some((o) => o.value === modalidadRaw)
      ? modalidadRaw
      : ""
  ) as SharedShipmentFields["modalidadTransito"];

  return {
    fechaLlegadaBuque: first.fechaLlegadaBuque ?? "",
    puerto: formatPuertosDescarga(
      parsePuertosDescarga(first.puerto ?? "")
    ),
    modalidadTransito,
    aduanaTransito: first.aduanaTransito ?? "",
    aduana: first.aduana ?? "",
    numeroBl: first.numeroBl ?? "",
    paisOrigen: first.paisOrigen ?? "",
    tasaCambioBcv: first.tasaCambioBcv ?? "",
    sobrescribir: false,
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

/**
 * Aplica datos de embarque compartidos a todas las filas.
 * Campos vacíos en `shared` no se tocan.
 * `force: true` (botón Aplicar) pisa valores; si no, solo rellena huecos.
 */
export function applySharedShipmentToRows(
  rows: CargaMasivaRow[],
  shared: SharedShipmentFields,
  options?: ApplySharedRowOptions
): CargaMasivaRow[] {
  const force = options?.force ?? shared.sobrescribir;
  const only = rowIdsFilter(options?.ids);
  const fecha = shared.fechaLlegadaBuque.trim();
  const puerto = shared.puerto.trim();
  const modalidad = shared.modalidadTransito;
  const aduanaTransito = shared.aduanaTransito.trim();
  const aduana = shared.aduana.trim();
  const numeroBl = shared.numeroBl.trim();
  const paisOrigen = shared.paisOrigen.trim();
  const tasa = shared.tasaCambioBcv.trim();

  if (
    !fecha &&
    !puerto &&
    !modalidad &&
    !aduanaTransito &&
    !aduana &&
    !numeroBl &&
    !paisOrigen &&
    !tasa
  ) {
    return rows;
  }

  return rows.map((r) => {
    if (only && !only.has(r.id)) return r;
    const next: CargaMasivaRow = { ...r, error: null };

    if (fecha && (force || isBlankTech(r.fechaLlegadaBuque))) {
      next.fechaLlegadaBuque = fecha;
    }
    if (puerto && (force || isBlankTech(r.puerto))) {
      next.puerto = formatPuertosDescarga(parsePuertosDescarga(puerto));
    }
    if (modalidad && (force || isBlankTech(r.modalidadTransito))) {
      next.modalidadTransito = modalidad;
      if (modalidad === "ninguno") {
        next.aduanaTransito = "";
      }
    }
    if (
      aduanaTransito &&
      modalidad !== "ninguno" &&
      (force || isBlankTech(r.aduanaTransito))
    ) {
      next.aduanaTransito = aduanaTransito;
    }
    if (aduana && (force || isBlankTech(r.aduana))) {
      next.aduana = aduana;
    }
    if (numeroBl && (force || isBlankTech(r.numeroBl))) {
      next.numeroBl = numeroBl;
    }
    if (paisOrigen && (force || isBlankTech(r.paisOrigen))) {
      next.paisOrigen = paisOrigen;
    }
    if (tasa && (force || isBlankTech(r.tasaCambioBcv))) {
      next.tasaCambioBcv = tasa;
    }

    return next;
  });
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
