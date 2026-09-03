import {
  DOCUMENTO_TIPOS,
  type DocumentoTipo,
} from "@/lib/schemas/vehiculo-documentos";

/** Prefijo en el bucket `vehiculos-documentos`. */
export const DEMO_PLANTILLAS_FOLDER = "demo-plantillas";

export const DEMO_PLANTILLA_FILENAME_RE =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,118}\.pdf$/i;

export const DEMO_UNIDADES = 3 as const;

export type DemoUnidadIndex = 1 | 2 | 3;

/** PDFs de la carga (generales). */
export const DEMO_PLANTILLA_PASO_CARGA: readonly DocumentoTipo[] = [
  "factura_comercial",
  "certificado_origen",
];

/** PDFs que unifican la carga en un BL. */
export const DEMO_PLANTILLA_PASO_BL: readonly DocumentoTipo[] = [
  "bl_guia",
  "lista_empaque",
];

/** PDFs que se esperan en la nube para la demo. */
export const DEMO_PLANTILLA_ARCHIVOS_ESPERADOS = [
  "factura_comercial.pdf",
  "certificado_origen.pdf",
  "bl_guia.pdf",
  "lista_empaque.pdf",
] as const;

export const DEMO_IMPORTADOR_NOMBRE = "Importador Demo (piloto)";

export const DEMO_VEHICULO = {
  marca: "Toyota",
  modelo: "Hilux",
  anio: 2024,
} as const;

export const DEMO_UNIDAD_COLORES: Record<DemoUnidadIndex, string> = {
  1: "Blanco",
  2: "Plata",
  3: "Negro",
};

const STEM_ALIASES: Record<string, DocumentoTipo> = {
  factura: "factura_comercial",
  factura_compra: "factura_comercial",
  invoice: "factura_comercial",
  certificado: "certificado_origen",
  origen: "certificado_origen",
  bl: "bl_guia",
  guia: "bl_guia",
  conocimiento: "bl_guia",
  packing: "lista_empaque",
  packing_list: "lista_empaque",
  empaque: "lista_empaque",
  lista: "lista_empaque",
  poliza: "poliza_transporte",
  titulo_propiedad: "titulo",
  identificacion: "cedula_importador",
  cedula: "cedula_importador",
  id: "cedula_importador",
  rif: "rif_importador",
};

export function isSafeDemoPlantillaFilename(name: string): boolean {
  return DEMO_PLANTILLA_FILENAME_RE.test(name.trim());
}

export function demoPlantillaPath(filename: string): string {
  return `${DEMO_PLANTILLAS_FOLDER}/${filename.trim()}`;
}

export function plantillaStem(filename: string): string {
  return filename
    .trim()
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Mapea `factura_comercial.pdf` → tipo de documento del expediente. */
export function mapPlantillaFilenameToTipo(
  filename: string
): DocumentoTipo | null {
  const stem = plantillaStem(filename);
  if ((DOCUMENTO_TIPOS as readonly string[]).includes(stem)) {
    return stem as DocumentoTipo;
  }
  return STEM_ALIASES[stem] ?? null;
}

function tallerHex(tallerId: string): string {
  return tallerId.replace(/-/g, "").toUpperCase();
}

/** Serial / VIN estable por taller y unidad (17 caracteres). */
export function demoSerialFromTallerId(
  tallerId: string,
  unidad: DemoUnidadIndex
): string {
  const hex = tallerHex(tallerId).slice(0, 12).padEnd(12, "0");
  return `DEMO${hex}${unidad}`;
}

/** Serial de la demo de 1 expediente (antes de las 3 unidades). */
export function demoSerialLegacyFromTallerId(tallerId: string): string {
  const hex = tallerHex(tallerId).slice(0, 13).padEnd(13, "0");
  return `DEMO${hex}`;
}

export function demoMotorFromTallerId(
  tallerId: string,
  unidad: DemoUnidadIndex
): string {
  const hex = tallerHex(tallerId).slice(0, 9).padEnd(9, "0");
  return `MOT${hex}${unidad}`;
}

export function demoNumeroBlFromTallerId(tallerId: string): string {
  const hex = tallerHex(tallerId).slice(0, 6).padEnd(6, "0");
  return `DEMOBL${hex}`;
}

/** RIF jurídico de formato válido, derivado del taller. */
export function demoRifFromTallerId(tallerId: string): string {
  const digits = tallerId.replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
  return `J-${digits}-0`;
}

export function demoPasoDeTipo(
  tipo: DocumentoTipo
): "carga" | "bl" | "otro" {
  if ((DEMO_PLANTILLA_PASO_CARGA as readonly string[]).includes(tipo)) {
    return "carga";
  }
  if ((DEMO_PLANTILLA_PASO_BL as readonly string[]).includes(tipo)) {
    return "bl";
  }
  return "otro";
}
