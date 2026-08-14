/**
 * Semáforo de completitud de datos del vehículo (carga masiva + expediente).
 * - verde: nada pendiente
 * - ámbar: faltan datos medios (motor, color, año, cert.)
 * - rojo: faltan datos fuertes (marca, modelo) o VIN inválido
 *
 * Registrable = VIN de 17 caracteres (el expediente se crea igual; lo pendiente se completa después).
 */

export type CompletitudNivel = "rojo" | "ambar" | "verde";

export type CompletitudDatos = {
  nivel: CompletitudNivel;
  /** Campos que faltan o son placeholder. */
  pendientes: string[];
  /** Críticos (marca/modelo/VIN). */
  criticos: string[];
  /** Medios (motor/color/año/cert). */
  medios: string[];
  /** Se puede crear el expediente. */
  registrable: boolean;
  label: string;
  detail: string;
};

const PLACEHOLDER_RE = /^(POR-COMPLETAR|N\/?A|S\/?D|-)?$/i;

export function isPlaceholderDato(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v) return true;
  return PLACEHOLDER_RE.test(v);
}

export function normalizeVinKey(raw: string | null | undefined): string {
  let v = (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (/^LWV|^LV[WY]|^LYV|^LWW/.test(v)) v = `LVV${v.slice(3)}`;
  return v;
}

export function isVinRegistrable(raw: string | null | undefined): boolean {
  const v = normalizeVinKey(raw);
  return v.length === 17 && /^[A-HJ-NPR-Z0-9]{17}$/.test(v);
}

export type CompletitudInput = {
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  anio?: string | number | null;
  serialMotor?: string | null;
  vin?: string | null;
  serialCarroceria?: string | null;
  numeroCertificadoOrigen?: string | null;
};

export function computeCompletitudDatos(
  input: CompletitudInput
): CompletitudDatos {
  const criticos: string[] = [];
  const medios: string[] = [];

  const vinRaw = input.serialCarroceria || input.vin || "";
  const vin = normalizeVinKey(vinRaw);
  const registrable = isVinRegistrable(vin);

  if (!vin) criticos.push("VIN");
  else if (vin.length !== 17) criticos.push("VIN incompleto");
  else if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) criticos.push("VIN");

  if (isPlaceholderDato(input.marca)) criticos.push("marca");
  if (isPlaceholderDato(input.modelo)) criticos.push("modelo");

  if (isPlaceholderDato(input.serialMotor)) medios.push("motor");
  if (isPlaceholderDato(input.color)) medios.push("color");
  const anioStr =
    input.anio == null || input.anio === ""
      ? ""
      : String(input.anio).trim();
  if (!anioStr || PLACEHOLDER_RE.test(anioStr)) medios.push("año");
  if (isPlaceholderDato(input.numeroCertificadoOrigen)) medios.push("nº cert.");

  const pendientes = [...criticos, ...medios];

  if (!registrable || criticos.length > 0) {
    return {
      nivel: "rojo",
      pendientes,
      criticos,
      medios,
      registrable,
      label: registrable
        ? "Rojo · se crea; completar marca/modelo"
        : "Rojo · sin VIN (no se registra)",
      detail:
        criticos.length > 0
          ? `Falta: ${criticos.join(", ")}`
          : "Sin VIN válido",
    };
  }

  if (medios.length > 0) {
    return {
      nivel: "ambar",
      pendientes,
      criticos,
      medios,
      registrable: true,
      label: "Ámbar · completar después",
      detail: `Completar: ${medios.join(", ")}`,
    };
  }

  return {
    nivel: "verde",
    pendientes: [],
    criticos,
    medios,
    registrable: true,
    label: "Verde · datos completos",
    detail: "Sin pendientes de datos del vehículo",
  };
}

/** Placeholder seguro para alta en BD cuando falta un dato. */
export function placeholderOValor(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v || PLACEHOLDER_RE.test(v)) return "POR-COMPLETAR";
  return v;
}
