import {
  DOCUMENTO_TIPOS,
  type DocumentoTipo,
} from "@/lib/schemas/vehiculo-documentos";

/** Prefijo en el bucket `vehiculos-documentos`. */
export const DEMO_PLANTILLAS_FOLDER = "demo-plantillas";

export const DEMO_PLANTILLA_FILENAME_RE =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,118}\.pdf$/i;

/** PDFs que se esperan en la nube para la demo (fase 1 + embarque). */
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
  color: "Blanco",
  anio: 2024,
} as const;

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

/** Serial / VIN estable por taller (17 caracteres). */
export function demoSerialFromTallerId(tallerId: string): string {
  const hex = tallerId.replace(/-/g, "").toUpperCase().slice(0, 13).padEnd(13, "0");
  return `DEMO${hex}`;
}

export function demoMotorFromTallerId(tallerId: string): string {
  const hex = tallerId.replace(/-/g, "").toUpperCase().slice(0, 10).padEnd(10, "0");
  return `MOT${hex}`;
}

/** RIF jurídico de formato válido, derivado del taller. */
export function demoRifFromTallerId(tallerId: string): string {
  const digits = tallerId.replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
  return `J-${digits}-0`;
}
